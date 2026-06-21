jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { id: 10, academyId: 5, role: 'owner' };
    next();
  }),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../config/database');
const peakSsoRouter = require('../../routes/peakSso');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/paca/peak-sso', peakSsoRouter);
  return app;
}

beforeEach(() => {
  db.query.mockReset();
  db.query.mockResolvedValue([{}]);
  process.env.PEAK_FRONTEND_URL = 'https://peak-rose.vercel.app';
});

describe('POST /paca/peak-sso/code', () => {
  test('returns a one-time Peak login URL', async () => {
    const res = await request(makeApp())
      .post('/paca/peak-sso/code')
      .set('Authorization', 'Bearer paca-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.code).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.peakUrl).toBe(`https://peak-rose.vercel.app/login?code=${res.body.code}`);
  });
});
