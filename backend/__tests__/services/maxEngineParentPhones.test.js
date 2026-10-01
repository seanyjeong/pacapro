process.env.DATA_ENCRYPTION_KEY = 'isolated-engine-parent-phone-unit-key';
jest.mock('../../config/database', () => ({ execute: jest.fn() }));
jest.mock('../../config/peak-database', () => ({ execute: jest.fn() }));
jest.mock('../../repositories/maxEngineFullCommandRepository', () => ({ insert: jest.fn(), update: jest.fn() }));
const repo = require('../../repositories/maxEngineFullCommandRepository');
const students = require('../../services/maxEngineFullStudents');
const { validate } = require('../../services/maxEngineFullCommands');
const { decrypt } = require('../../utils/encryption');

beforeEach(() => { jest.clearAllMocks(); repo.insert.mockResolvedValue(10); });
const create = contacts => validate({ operation: 'student_create', changes: {
  name: '합성 예비', phone: '01011112222', enrollment_date: '2026-10-02',
  registration_source: 'max_engine', parent_phone: '010-9999-8888', ...contacts,
} });

test.each([
  [{ father_phone: '01012345678', mother_phone: ' 010-8765-4321 ' }, '010-1234-5678', '010-8765-4321'],
  [{ father_phone: '01012345678' }, '010-1234-5678', undefined],
  [{ mother_phone: '01087654321' }, undefined, '010-8765-4321'],
  [{ father_phone: '', mother_phone: ' ' }, null, null],
  [{ father_phone: null, mother_phone: null }, null, null],
  [{}, undefined, undefined],
])('engine registration normalizes and encrypts optional parent contacts %j', async (input, father, mother) => {
  const command = create(input);
  expect(command.changes.father_phone).toBe(father);
  expect(command.changes.mother_phone).toBe(mother);
  await students.create({}, { academy_id: 1 }, command.changes, []);
  const row = repo.insert.mock.calls[0][2];
  expect(row.status).toBe('prospect');
  expect(decrypt(row.parent_phone)).toBe('010-9999-8888');
  for (const [field, expected] of [['father_phone', father], ['mother_phone', mother]]) {
    if (expected === undefined) expect(row).not.toHaveProperty(field);
    else if (expected === null) expect(row[field]).toBeNull();
    else { expect(row[field]).toMatch(/^ENC:/); expect(decrypt(row[field])).toBe(expected); }
  }
});

test.each(['father_phone', 'mother_phone'])('invalid %s uses ordinary registration error before storage', field => {
  const label = field === 'father_phone' ? '아버지' : '어머니';
  for (const value of ['invalid', '0101234567\n', 1012345678, 'ENC:forged']) {
    expect(() => create({ [field]: value })).toThrow(`${label} 전화번호를 올바르게 입력해주세요.`);
  }
  expect(repo.insert).not.toHaveBeenCalled();
});

test('partial update clears only the supplied contact and leaves representative phone untouched', async () => {
  const command = validate({ operation: 'student_update', resource_id: 10, changes: { father_phone: '' } });
  await students.update({}, 10, command.changes);
  expect(repo.update).toHaveBeenCalledWith({}, 'students', 10, { father_phone: null });
});
