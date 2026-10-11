jest.mock('../../config/database', () => ({ execute: jest.fn() }));
jest.mock('../../config/peak-database', () => ({}));
jest.mock('../../utils/solapi', () => ({ sendSMSSolapi: jest.fn() }));
jest.mock('../../utils/naverSens', () => ({ decryptApiKey: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const db = require('../../config/database');
const { sendSMSSolapi } = require('../../utils/solapi');
const { decryptApiKey } = require('../../utils/naverSens');
const logger = require('../../utils/logger');
const key = crypto.randomBytes(32).toString('hex');
const original = { ...process.env };
const app = express();
app.use(express.json());
app.use('/paca/integrations', require('../../routes/integrations'));
const base = '/paca/integrations/max-engine/sms';
const status = (query = { academy_id: '2' }, supplied = key) => request(app).get(base + '/status')
  .set('X-Max-Engine-Sync-Key', supplied).query(query);
const message = { academy_id: 2, to: '01090000060', text: '[맥스 합성] 인증번호 123456 — 3분 안에 넣어 주세요.', purpose: 'invite' };
const send = (body = message, supplied = key) => request(app).post(base + '/send').set('X-Max-Engine-Sync-Key', supplied).send(body);
function settings({ type = 'solapi', apiKey = 'synthetic-key', secret = 'iv:cipher', column = null, sender = '010-0000-0001' } = {}) {
  db.execute.mockReset()
    .mockResolvedValueOnce([[{ service_type: type, solapi_api_key: apiKey, solapi_api_secret: secret, solapi_sender_phone: column }]])
    .mockResolvedValueOnce([sender ? [{ phone: sender }] : []]);
}
beforeEach(() => {
  jest.clearAllMocks();
  db.execute.mockReset();
  process.env.MAX_ENGINE_SYNC_KEY = key;
  process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '2,4';
  decryptApiKey.mockImplementation(value => value ? 'synthetic-secret' : null);
});
afterAll(() => { process.env = original; });

test('same gate as sync: env, shared key, internal call and academy allowlist before any DB read', async () => {
  delete process.env.MAX_ENGINE_SYNC_KEY;
  expect((await status()).status).toBe(503);
  process.env.MAX_ENGINE_SYNC_KEY = key;
  delete process.env.MAX_ENGINE_SYNC_ACADEMY_IDS;
  expect((await send()).status).toBe(503);
  process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '2,4';
  expect((await status(undefined, 'wrong')).status).toBe(401);
  expect((await send(message, 'wrong')).status).toBe(401);
  for (const header of ['X-Forwarded-For', 'Forwarded', 'X-Real-IP']) {
    expect((await status().set(header, '127.0.0.1')).status).toBe(403);
  }
  expect((await status({ academy_id: '3' })).body.error.code).toBe('SYNC_ACADEMY_FORBIDDEN');
  expect((await send({ ...message, academy_id: 3 })).status).toBe(403);
  for (const query of [{}, { academy_id: '0' }, { academy_id: 'x' }]) expect((await status(query)).status).toBe(422);
  expect((await status({ academy_id: '2', extra: '1' })).status).toBe(422);
  expect(db.execute).not.toHaveBeenCalled();
});

test('status reports only whether solapi keys and a sender number exist — never the values', async () => {
  settings();
  const ok = await status();
  expect(ok.status).toBe(200);
  expect(ok.headers['cache-control']).toBe('no-store');
  expect(ok.body).toEqual({ solapi: true, sender_number: true });
  expect(db.execute.mock.calls[0][1]).toEqual([2]);
  settings({ sender: null, column: '010-0000-0002' });
  expect((await status()).body).toEqual({ solapi: true, sender_number: true });
  settings({ sender: null });
  expect((await status()).body).toEqual({ solapi: true, sender_number: false });
  settings({ type: 'sens' });
  expect((await status()).body).toEqual({ solapi: false, sender_number: true });
  settings({ secret: null });
  expect((await status()).body).toEqual({ solapi: false, sender_number: true });
  db.execute.mockReset().mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
  expect((await status()).body).toEqual({ solapi: false, sender_number: false });
  db.execute.mockReset().mockRejectedValue(new Error('SELECT secret failed'));
  const broken = await status();
  expect(broken.status).toBe(503);
  expect(JSON.stringify(broken.body)).not.toMatch(/SELECT|secret/);
});

test('send uses the academy solapi settings and default sender, returns message_id, logs no text or number', async () => {
  settings();
  sendSMSSolapi.mockResolvedValue({ success: true, messageId: 'M-1', failedCount: 0, messageType: 'SMS' });
  const ok = await send();
  expect(ok.status).toBe(200);
  expect(ok.body).toEqual({ message_id: 'M-1' });
  expect(sendSMSSolapi).toHaveBeenCalledWith({ solapi_api_key: 'synthetic-key', solapi_api_secret: 'synthetic-secret',
    solapi_sender_phone: '010-0000-0001' }, [{ phone: '01090000060' }], message.text);
  const logged = JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls, logger.error.mock.calls]);
  expect(logged).toContain('result=sent');
  expect(logged).not.toMatch(/0109000|인증번호|123456/);
});

test('missing solapi settings are 409, solapi failures (HTTP or rejected message) are 502', async () => {
  settings({ sender: null });
  expect((await send()).status).toBe(409);
  settings({ type: 'sens' });
  expect((await send()).body.error.code).toBe('SMS_NOT_CONFIGURED');
  expect(sendSMSSolapi).not.toHaveBeenCalled();
  settings();
  sendSMSSolapi.mockResolvedValue({ success: false, error: 'synthetic', statusCode: 400 });
  expect((await send()).status).toBe(502);
  settings();
  sendSMSSolapi.mockResolvedValue({ success: true, messageId: undefined, failedCount: 1, messageType: 'SMS' });
  const rejected = await send();
  expect(rejected.status).toBe(502);
  expect(rejected.body.error.code).toBe('SMS_SEND_FAILED');
  expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/0109000|인증번호/);
});

test('send accepts only the contract body', async () => {
  for (const body of [{ ...message, extra: 1 }, { ...message, academy_id: '2' }, { ...message, to: '010-9000-0060' },
    { ...message, to: '0212345678' }, { ...message, text: ' ' }, { ...message, text: '가'.repeat(700) },
    { ...message, purpose: 'Invite!' }, { academy_id: 2 }]) {
    expect((await send(body)).status).toBe(422);
  }
  expect(db.execute).not.toHaveBeenCalled();
});
