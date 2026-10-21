const crypto = require('crypto');
const { GOOGLE, SCOPES, config } = require('../../config/google');
const repo = require('../../repositories/google/connection');
const calendarRepo = require('../../repositories/google/calendar');
const { ensureCalendar } = require('./ensureCalendar');
const { hash, seal, unseal } = require('./security');
const { request, tokenRequest, hasScope, accessToken, GoogleError } = require('./client');

function requireConfig() { if (!config().configured) throw new GoogleError('GOOGLE_NOT_CONFIGURED'); }
async function status(academyId) {
    const row = await repo.status(academyId);
    return { configured: config().configured, worker_enabled: config().workerEnabled,
        connected: Boolean(row?.refresh_token), email: row?.email || null,
        last_error: row?.last_error || null, last_synced_at: row?.last_synced_at || null,
        services: Object.fromEntries(Object.keys(SCOPES).map(service => [service, {
            enabled: Boolean(row?.[`${service}_enabled`]), granted: hasScope(row, service), implemented: service === 'calendar',
        }])) };
}
async function authorize(user) {
    requireConfig();
    const academyId = user.academyId ?? user.academy_id;
    const state = crypto.randomBytes(32).toString('base64url');
    const browser = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    await repo.issueState({ academyId, userId: user.id, stateHash: hash(state), browserHash: hash(browser),
        verifier: seal(verifier, academyId), expiresAt: Math.floor(Date.now() / 1000) + GOOGLE.stateSeconds });
    const url = new URL(config().redirectUri.replace(/\/callback$/, '/start'));
    url.search = new URLSearchParams({ state, ticket: browser }).toString();
    return { url: url.toString() };
}
async function start(state, browser) {
    requireConfig();
    if (typeof state !== 'string' || typeof browser !== 'string') throw new GoogleError('INVALID_OAUTH_STATE', 400);
    const row = await repo.startState(hash(state), hash(browser));
    if (!row) throw new GoogleError('INVALID_OAUTH_STATE', 400);
    const verifier = unseal(row.verifier, row.academy_id);
    const url = new URL(GOOGLE.authorizeUrl);
    url.search = new URLSearchParams({ client_id: config().clientId, redirect_uri: config().redirectUri,
        response_type: 'code', scope: GOOGLE.scopes.join(' '), access_type: 'offline', prompt: 'consent',
        include_granted_scopes: 'true', state,
        code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    return { url: url.toString(), browser };
}
async function callback(query, browser) {
    requireConfig();
    if (typeof query.state !== 'string' || !browser) throw new GoogleError('INVALID_OAUTH_STATE', 400);
    const state = await repo.consumeState(hash(query.state), hash(browser));
    if (!state) throw new GoogleError('INVALID_OAUTH_STATE', 400);
    if (query.error || typeof query.code !== 'string') throw new GoogleError('GOOGLE_CONSENT_DENIED', 400);
    const result = await repo.locked(state.academy_id, async conn => {
        if (!await repo.canManage(conn, state.user_id, state.academy_id)) throw new GoogleError('GOOGLE_FORBIDDEN', 403);
        const tokens = await tokenRequest({ grant_type: 'authorization_code', code: query.code,
            code_verifier: unseal(state.verifier, state.academy_id), redirect_uri: config().redirectUri });
        if (!tokens.refresh_token || !tokens.access_token || !Number.isFinite(tokens.expires_in)) throw new GoogleError('RECONNECT_REQUIRED');
        const headers = { Authorization: `Bearer ${tokens.access_token}` };
        const identity = await request({ url: GOOGLE.userInfoUrl, headers });
        if (!identity.sub || !identity.email || identity.email_verified !== true) throw new GoogleError('GOOGLE_IDENTITY_INVALID');
        const scopes = tokens.scope || '';
        // A partial consent can still connect Drive/Sheets; calendar stays off until its permissions are granted.
        const previous = await repo.get(conn, state.academy_id);
        const calendarId = previous?.account_id === identity.sub ? previous.calendar_id : '';
        await repo.save(conn, { academy_id: state.academy_id, account_id: identity.sub, email: identity.email,
            calendar_id: calendarId, connection_key: hash(`${config().namespace}:${state.academy_id}:${identity.sub}:${calendarId}`),
            access_token: seal(tokens.access_token, state.academy_id), refresh_token: seal(tokens.refresh_token, state.academy_id),
            expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in, scopes });
        return { connected: true };
    });
    if (result.busy) throw new GoogleError('GOOGLE_BUSY', 409);
}
async function setService(academyId, service, enabled) {
    if (!Object.hasOwn(SCOPES, service) || typeof enabled !== 'boolean') throw new GoogleError('INVALID_SERVICE', 400);
    const result = await repo.locked(academyId, async conn => {
        const row = await repo.get(conn, academyId);
        if (enabled && (!row?.refresh_token || !hasScope(row, service))) throw new GoogleError('GOOGLE_PERMISSION_REQUIRED', 409);
        let calendar;
        if (service === 'calendar' && enabled && !row.calendar_id) {
            calendar = await ensureCalendar(await accessToken(conn, row), academyId);
            if (!calendar?.id) throw new GoogleError('GOOGLE_CALENDAR_INVALID');
        }
        await conn.beginTransaction();
        try {
            if (calendar) await repo.setCalendar(conn, academyId, calendar.id,
                hash(`${config().namespace}:${academyId}:${row.account_id}:${calendar.id}`));
            await repo.setService(conn, academyId, service, enabled);
            if (service === 'calendar' && enabled) await calendarRepo.seed(conn, academyId);
            await conn.commit();
        } catch (error) { await conn.rollback(); throw error; }
    });
    if (result?.busy) throw new GoogleError('GOOGLE_BUSY', 409);
    return status(academyId);
}
async function disconnect(academyId) {
    const result = await repo.locked(academyId, conn => repo.disconnect(conn, academyId));
    if (result?.busy) throw new GoogleError('GOOGLE_BUSY', 409);
    return status(academyId);
}
module.exports = { status, authorize, start, callback, setService, disconnect };
