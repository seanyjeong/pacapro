const axios = require('axios');
const { GOOGLE, config, SCOPES } = require('../../config/google');
const repo = require('../../repositories/google/connection');
const { seal, unseal } = require('./security');

class GoogleError extends Error {
    constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
async function request(options) {
    try {
        return (await axios({ ...options, timeout: GOOGLE.timeoutMs, maxRedirects: 0 })).data;
    } catch (error) {
        const status = error.response?.status || 503;
        const code = error.response?.data?.error;
        throw new GoogleError(code === 'invalid_grant' ? 'RECONNECT_REQUIRED' : `GOOGLE_${status}`, status);
    }
}
function tokenRequest(fields) {
    const cfg = config();
    return request({ method: 'POST', url: GOOGLE.tokenUrl,
        data: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...fields }).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
}
function hasScope(row, service) {
    const granted = new Set((row?.scopes || '').split(' '));
    return SCOPES[service]?.every(scope => granted.has(scope)) || false;
}
// Callers hold the per-academy connection lock: refresh and settings cannot race the worker.
async function accessToken(conn, row, force = false) {
    if (!row?.refresh_token) throw new GoogleError('RECONNECT_REQUIRED');
    if (!force && row.access_token && Number(row.expires_at) > Date.now() / 1000 + 60) {
        return unseal(row.access_token, row.academy_id);
    }
    const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: unseal(row.refresh_token, row.academy_id) });
    if (!tokens.access_token || !Number.isFinite(tokens.expires_in)) throw new GoogleError('GOOGLE_TOKEN_INVALID');
    const refresh = tokens.refresh_token ? seal(tokens.refresh_token, row.academy_id) : row.refresh_token;
    const access = seal(tokens.access_token, row.academy_id);
    const expires = Math.floor(Date.now() / 1000) + tokens.expires_in;
    await repo.tokens(conn, row.academy_id, access, refresh, expires);
    Object.assign(row, { access_token: access, refresh_token: refresh, expires_at: expires });
    return tokens.access_token;
}
async function calendarRequest(conn, row, method, path, data, params) {
    async function send(force) {
        const token = await accessToken(conn, row, force);
        return request({ method, url: `${GOOGLE.calendarUrl}/calendars/${encodeURIComponent(row.calendar_id)}${path}`,
            headers: { Authorization: `Bearer ${token}` }, data, params });
    }
    try { return await send(false); }
    catch (error) { if (error.status === 401) return send(true); throw error; }
}
module.exports = { GoogleError, request, tokenRequest, hasScope, accessToken, calendarRequest };
