jest.mock('../../config/database', () => ({}));
jest.mock('../../repositories/maxEngineSyncRepository', () => ({ serverTime: jest.fn(), students: jest.fn() }));
jest.mock('../../repositories/maxEngineRepository', () => ({ userById: jest.fn() }));
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const linkRepo = require('../../repositories/maxEngineRepository');
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
  process.env.MAX_ENGINE_LINK_SECRET = crypto.randomBytes(32).toString('hex');
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
    grade: '고3', phone: encrypt('000111'), parent_phone: null, father_phone: encrypt('000333'), mother_phone: null,
    admission_type: 'both', status: 'prospect',
    deleted_at: '2026-10-05 09:00:00', updated_at: '2026-10-06 09:00:00', birth_date: '2000-01-01', notes: 'private' };
  repository.students.mockResolvedValue([row]);
  const result = await read(1);
  expect(result).toEqual({ items: [{ paca_student_id: 3, academy_id: 1, name: '합성학생', gender: 'female',
    school_name: null, grade: '고3', phone: '000111', parent_phone: null, father_phone: '000333', mother_phone: null,
    admission_type: 'both', status: 'prospect',
    deleted_at: '2026-10-05T00:00:00.000Z', updated_at: '2026-10-06T00:00:00.000Z' }],
    next_cursor: null, server_time: '2026-10-06T00:00:00.000Z' });
  repository.students.mockResolvedValue([{ ...row, name: 'ENC:broken' }]);
  await expect(read(1)).rejects.toMatchObject({ status: 503, code: 'DECRYPT_FAILED' });
});
test('an academy outside the allowlist is read with its max-engine link token, even after the token expired', async () => {
  repository.serverTime.mockResolvedValue('2026-10-27T00:00:00.000Z');
  repository.students.mockResolvedValue([]);
  const owner = { id: 7, academy_id: 51, role: 'owner', is_active: 1, approval_status: 'approved' };
  const token = (claims, secret = process.env.MAX_ENGINE_LINK_SECRET) => jwt.sign(
    { academy_id: 51, scope: 'students:read records:read', credential_version: 'old', ...claims }, secret,
    { algorithm: 'HS256', issuer: 'paca-max-engine', audience: 'max-engine-read', subject: '7', expiresIn: -60 });
  const readWith = (id, link) => service.students({ academy_id: String(id) }, key, '127.0.0.1', { 'x-max-engine-link': link });
  linkRepo.userById.mockResolvedValue(owner);
  await expect(readWith(51, token())).resolves.toMatchObject({ items: [] });
  expect(repository.students).toHaveBeenCalledTimes(1);
  repository.students.mockClear();
  const denied = [
    [51, undefined], [51, 'not-a-token'], [51, token({}, crypto.randomBytes(32).toString('hex'))],
    [52, token()], [51, token({ academy_id: 52 })], [51, token({ scope: 'students:read' })],
  ];
  for (const [id, link] of denied) {
    await expect(readWith(id, link)).rejects.toMatchObject({ status: 403, code: 'SYNC_ACADEMY_FORBIDDEN' });
  }
  for (const user of [null, { ...owner, academy_id: 52 }, { ...owner, role: 'teacher' }, { ...owner, is_active: 0 },
    { ...owner, approval_status: 'pending' }]) {
    linkRepo.userById.mockResolvedValue(user);
    await expect(readWith(51, token())).rejects.toMatchObject({ status: 403, code: 'SYNC_ACADEMY_FORBIDDEN' });
  }
  delete process.env.MAX_ENGINE_LINK_SECRET;
  linkRepo.userById.mockResolvedValue(owner);
  await expect(readWith(51, token({}, 'x'.repeat(64)))).rejects.toMatchObject({ status: 403 });
  expect(repository.students).not.toHaveBeenCalled();
});
