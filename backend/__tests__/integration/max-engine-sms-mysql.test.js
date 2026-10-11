/** Real HTTP + isolated MySQL + synthetic Solapi (axios mocked); no production credentials or real phone numbers. */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__smsPaca);
jest.mock('../../config/peak-database', () => ({}));
jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const axios = require('axios');
const logger = require('../../utils/logger');
const base = '/paca/integrations/max-engine/sms';
const key = crypto.randomBytes(32).toString('hex');
run('max-engine SMS window with native MySQL settings', () => {
  let admin, pool, server;
  const original = { ...process.env };
  const database = 'max_engine_sms_test_paca';
  beforeAll(async () => {
    const port = Number(process.env.TEST_MYSQL_PORT);
    if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
    const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true, timezone: '+09:00' };
    admin = await mysql.createConnection(options);
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
    pool = mysql.createPool({ ...options, database });
    await pool.query(`CREATE TABLE notification_settings (id INT AUTO_INCREMENT PRIMARY KEY, academy_id INT NOT NULL UNIQUE,
      service_type ENUM('sens','solapi'), solapi_api_key VARCHAR(255), solapi_api_secret VARCHAR(500), solapi_sender_phone VARCHAR(20))`);
    await pool.query(`CREATE TABLE sender_numbers (id INT AUTO_INCREMENT PRIMARY KEY, academy_id INT NOT NULL,
      service_type ENUM('solapi','sens') NOT NULL, phone VARCHAR(20) NOT NULL, label VARCHAR(50), is_default TINYINT(1))`);
    process.env.ENCRYPTION_KEY = crypto.randomBytes(16).toString('hex');
    const { encryptApiKey } = require('../../utils/naverSens');
    await pool.query('INSERT INTO notification_settings (academy_id, service_type, solapi_api_key, solapi_api_secret, solapi_sender_phone) VALUES ?',
      [[[2, 'solapi', 'synthetic-key', encryptApiKey('synthetic-secret', process.env.ENCRYPTION_KEY), null],
        [4, 'solapi', 'synthetic-key', encryptApiKey('synthetic-secret', process.env.ENCRYPTION_KEY), null]]]);
    await pool.query('INSERT INTO sender_numbers (academy_id, service_type, phone, is_default) VALUES ?',
      [[[2, 'solapi', '010-0000-0009', 0], [2, 'solapi', '010-0000-0001', 1], [2, 'sens', '010-0000-0002', 1]]]);
    global.__smsPaca = pool;
    process.env.MAX_ENGINE_SYNC_KEY = key;
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '2,4';
    const app = express(); app.use(express.json()); app.use('/paca/integrations', require('../../routes/integrations'));
    app.use(require('../../middleware/maxEnginePrivacy').errorHandler);
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
    await pool?.end(); await admin?.end(); process.env = original;
  });
  const status = academy => request(server).get(base + '/status').set('X-Max-Engine-Sync-Key', key).query({ academy_id: academy });
  test('status reads the real settings rows: default solapi sender counts, other service senders do not', async () => {
    expect((await status('2')).body).toEqual({ solapi: true, sender_number: true });
    expect((await status('4')).body).toEqual({ solapi: true, sender_number: false });
  });
  test('send decrypts the academy secret, sends one SMS/LMS from the default sender and logs counts only', async () => {
    axios.post.mockResolvedValue({ data: { messageList: [{ messageId: 'M-synthetic' }], failedMessageList: [] } });
    const text = '[맥스 합성] 학생 화면에 초대합니다. 7일 안에 한 번만 열 수 있어요: http://localhost/my?invite=synthetic-token';
    const response = await request(server).post(base + '/send').set('X-Max-Engine-Sync-Key', key)
      .send({ academy_id: 2, to: '01090000060', text, purpose: 'invite_link' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message_id: 'M-synthetic' });
    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toBe('https://api.solapi.com/messages/v4/send-many/detail');
    expect(body.messages).toEqual([{ to: '01090000060', from: '01000000001', text, type: 'LMS' }]);
    expect(options.headers.Authorization).toMatch(/^HMAC-SHA256 apiKey=synthetic-key, /);
    const logged = JSON.stringify(logger.info.mock.calls.concat(logger.warn.mock.calls, logger.error.mock.calls));
    expect(logged).toContain('academy=2 purpose=invite_link type=LMS result=sent');
    expect(logged).not.toMatch(/0109000|synthetic-token|초대합니다/);
    const conflict = await request(server).post(base + '/send').set('X-Max-Engine-Sync-Key', key)
      .send({ academy_id: 4, to: '01090000060', text: '합성', purpose: 'invite' });
    expect(conflict.status).toBe(409);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
  test('malformed JSON is answered by the integration privacy handler without echoing the body', async () => {
    const response = await request(server).post(base + '/send').set('X-Max-Engine-Sync-Key', key)
      .set('content-type', 'application/json').send('{"to":"01090000060"');
    expect(response.status).toBe(400);
    expect(response.text).not.toContain('0109000');
  });
});
