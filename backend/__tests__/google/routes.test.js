jest.mock('../../config/database', () => ({}));
jest.mock('../../services/google/connection', () => ({ status: jest.fn(), authorize: jest.fn(), start: jest.fn(), callback: jest.fn(), setService: jest.fn(), disconnect: jest.fn() }));
jest.mock('../../middleware/auth', () => ({ verifyToken: (req, res, next) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.user = { id: 41, academyId: 7, role: req.headers.authorization === 'owner' ? 'owner' : 'teacher' }; next();
} }));
const express = require('express');
const request = require('supertest');
const service = require('../../services/google/connection');
const { isIntegration } = require('../../middleware/maxEnginePrivacy');
const app = express(); app.use(express.json()); app.use('/paca/google-integration', require('../../routes/google-integration'));
const base = '/paca/google-integration';
beforeEach(() => jest.clearAllMocks());
test('owner-only management derives academy from authentication and rejects injected scope', async () => {
    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).get(base).set('Authorization', 'teacher')).status).toBe(403);
    expect((await request(app).put(`${base}/services/calendar`).set('Authorization', 'owner').send({ enabled: true, academy_id: 8 })).status).toBe(400);
    service.setService.mockResolvedValue({ connected: true });
    expect((await request(app).put(`${base}/services/calendar`).set('Authorization', 'owner').send({ enabled: true })).status).toBe(200);
    expect(service.setService).toHaveBeenCalledWith(7, 'calendar', true);
});
test('authorization bootstraps a first-party HttpOnly cookie; OAuth secrets never enter access logs', async () => {
    service.authorize.mockResolvedValue({ url: 'https://api.example.invalid/start?ticket=opaque' });
    const response = await request(app).post(`${base}/authorize`).set('Authorization', 'owner');
    expect(response.body).toEqual({ url: 'https://api.example.invalid/start?ticket=opaque' });
    service.start.mockResolvedValue({ url: 'https://accounts.google.com/oauth', browser: 'opaque' });
    process.env.GOOGLE_REDIRECT_URI = 'https://api.example.invalid/paca/google-integration/callback';
    const start = await request(app).get(`${base}/start?state=opaque&ticket=opaque`);
    expect(start.status).toBe(303);
    expect(start.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(start.headers['set-cookie'][0]).toMatch(/Secure/);
    expect(start.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    expect(isIntegration({ path: `${base}/callback` })).toBe(true);
    expect(start.headers['referrer-policy']).toBe('no-referrer');
});
test('provider responses never expose tokens or raw errors', async () => {
    service.status.mockRejectedValue(Object.assign(new Error('sensitive token'), { response: { data: 'secret' } }));
    const response = await request(app).get(base).set('Authorization', 'owner');
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toMatch(/secret|sensitive/);
});
