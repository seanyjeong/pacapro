jest.mock('../../config/database', () => ({}));
jest.mock('../../repositories/maxEngineSyncRepository', () => ({ serverTime: jest.fn(), students: jest.fn() }));
const crypto = require('crypto');
const config = require('../../config/maxEngineSync');
const repository = require('../../repositories/maxEngineSyncRepository');
const service = require('../../services/maxEngineSyncService');
const { encrypt } = require('../../services/maxEngineFullSecurity');
const key = crypto.randomBytes(32).toString('hex');
const original = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env.MAX_ENGINE_SYNC_KEY = key;
  process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1, 2,1';
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
});
afterAll(() => { process.env = original; });
const read = id => service.students({ academy_id: String(id) }, key, '127.0.0.1', {});
test('only complete positive id allowlists enable reading, and unauthorized academies never reach DB', async () => {
  expect([...config.academyIds()]).toEqual([1, 2]);
  for (const value of ['', ' ', '1,', '0,1', '-1', '1,2x', '9007199254740992']) {
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = value;
    await expect(read(1)).rejects.toMatchObject({ status: 503, code: 'SYNC_DISABLED' });
  }
  delete process.env.MAX_ENGINE_SYNC_ACADEMY_IDS;
  await expect(read(1)).rejects.toMatchObject({ status: 503 });
  process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '2';
  await expect(read(1)).rejects.toMatchObject({ status: 403 });
  expect(repository.students).not.toHaveBeenCalled();
  expect(repository.serverTime).not.toHaveBeenCalled();
});
test('read exports only the contract fields and decrypts required contacts; damaged ciphertext fails closed', async () => {
  repository.serverTime.mockResolvedValue('2026-10-06T00:00:00.000Z');
  const row = { id: 3, academy_id: 1, name: encrypt('합성학생'), gender: 'female', school: null,
    grade: '고3', phone: encrypt('000111'), parent_phone: null, admission_type: 'both', status: 'prospect',
    deleted_at: '2026-10-05 09:00:00', updated_at: '2026-10-06 09:00:00', birth_date: '2000-01-01', notes: 'private' };
  repository.students.mockResolvedValue([row]);
  const result = await read(1);
  expect(result).toEqual({ items: [{ paca_student_id: 3, academy_id: 1, name: '합성학생', gender: 'female',
    school_name: null, grade: '고3', phone: '000111', parent_phone: null, admission_type: 'both', status: 'prospect',
    deleted_at: '2026-10-05T00:00:00.000Z', updated_at: '2026-10-06T00:00:00.000Z' }],
    next_cursor: null, server_time: '2026-10-06T00:00:00.000Z' });
  repository.students.mockResolvedValue([{ ...row, name: 'ENC:broken' }]);
  await expect(read(1)).rejects.toMatchObject({ status: 503, code: 'DECRYPT_FAILED' });
});
