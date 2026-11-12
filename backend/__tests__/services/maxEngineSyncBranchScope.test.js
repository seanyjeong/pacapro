jest.mock('../../config/database', () => ({}));
jest.mock('../../repositories/maxEngineSyncRepository', () => ({ serverTime: jest.fn(), students: jest.fn(), branches: jest.fn() }));
jest.mock('../../repositories/maxEngineRepository', () => ({ userById: jest.fn() }));
const crypto = require('crypto');
const repository = require('../../repositories/maxEngineSyncRepository');
const service = require('../../services/maxEngineSyncService');
const { encrypt } = require('../../services/maxEngineFullSecurity');
const key = crypto.randomBytes(32).toString('hex');
const original = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env.MAX_ENGINE_SYNC_KEY = key;
  process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1';
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  repository.serverTime.mockResolvedValue('2026-11-12T00:00:00.000Z');
  repository.branches.mockResolvedValue([
    { id: 3, name: '수성', status: 'active', class_id: 8, class_name: '정시반', class_status: 'active' },
    { id: 3, name: '수성', status: 'active', class_id: 9, class_name: '수시반', class_status: 'active' },
    { id: 5, name: '칠곡', status: 'active', class_id: null, class_name: null, class_status: null },
  ]);
});
afterAll(() => { process.env = original; });
const read = query => service.students({ academy_id: '1', ...query }, key, '127.0.0.1', {});
const row = (id, branchId, extra = {}) => ({ id, academy_id: 1, name: encrypt('합성학생' + id), gender: 'male', school: null,
  grade: '고3', phone: encrypt('000111'), parent_phone: null, father_phone: null, mother_phone: null,
  admission_type: 'regular', status: 'active', deleted_at: null, updated_at: '2026-11-12 09:00:00',
  branch_id: branchId, class_id: branchId === 3 ? 8 : null, branch_name: branchId === 3 ? '수성' : branchId === 5 ? '칠곡' : null,
  class_name: branchId === 3 ? '정시반' : null, ...extra });

test('범위 없는 조회는 지점을 읽지 않고 응답 칸도 그대로다', async () => {
  repository.students.mockResolvedValue([row(1, 3)]);
  const result = await read({});
  expect(repository.branches).not.toHaveBeenCalled();
  expect(repository.students.mock.calls[0][0].branchIds).toBeUndefined();
  expect(Object.keys(result.items[0])).toEqual(['paca_student_id', 'academy_id', 'name', 'gender', 'school_name', 'grade',
    'phone', 'parent_phone', 'father_phone', 'mother_phone', 'admission_type', 'status', 'deleted_at', 'updated_at']);
});

test('범위 안 학생은 지점·반이 붙고, 범위 밖 학생은 개인정보 없이 번호와 out_of_scope 만 나간다', async () => {
  repository.students.mockResolvedValue([row(1, 3), row(2, 5), row(3, null)]);
  const result = await read({ branch_ids: '3' });
  expect(repository.students.mock.calls[0][0].branchIds).toEqual([3]);
  expect(result.items[0]).toMatchObject({ paca_student_id: 1, name: '합성학생1', branch_id: 3, branch_name: '수성', class_id: 8, class_name: '정시반' });
  expect(result.items.slice(1)).toEqual([
    { paca_student_id: 2, academy_id: 1, out_of_scope: true, updated_at: '2026-11-12T00:00:00.000Z' },
    { paca_student_id: 3, academy_id: 1, out_of_scope: true, updated_at: '2026-11-12T00:00:00.000Z' },
  ]);
});

test('범위 밖 학생은 암호가 깨져 있어도 풀지 않으므로 조회가 막히지 않는다', async () => {
  repository.students.mockResolvedValue([row(2, 5, { name: 'ENC:broken' })]);
  await expect(read({ branch_ids: '3' })).resolves.toMatchObject({ items: [{ paca_student_id: 2, out_of_scope: true }] });
});

test('이 교육원 지점이 아닌 번호나 잘못된 형식은 422 이고 학생을 읽지 않는다', async () => {
  for (const value of ['4', '3,4', '', '0', '3,,5', 'a', '3;5', Array.from({ length: 51 }, (_, i) => i + 1).join(',')]) {
    await expect(read({ branch_ids: value })).rejects.toMatchObject({ status: 422, code: 'SYNC_INVALID_QUERY' });
  }
  expect(repository.students).not.toHaveBeenCalled();
});

test('다음 쪽 표시는 지점 범위에 묶인다 — 범위를 바꾸거나 빼면 다시 쓸 수 없다', async () => {
  repository.students.mockResolvedValue(Array.from({ length: 201 }, (_, i) => row(i + 1, 3)));
  const first = await read({ branch_ids: '5,3,3' });
  expect(repository.students.mock.calls[0][0].branchIds).toEqual([3, 5]);
  expect(first.next_cursor).toEqual(expect.any(String));
  repository.students.mockResolvedValue([]);
  await expect(read({ branch_ids: '3,5', cursor: first.next_cursor })).resolves.toMatchObject({ items: [] });
  for (const query of [{ cursor: first.next_cursor }, { branch_ids: '3', cursor: first.next_cursor }]) {
    await expect(read(query)).rejects.toMatchObject({ status: 422, code: 'SYNC_INVALID_CURSOR' });
  }
});

test('지점 목록은 이름만 묶어서 내주고, 허용되지 않은 교육원은 읽지 않는다', async () => {
  const list = await service.branches({ academy_id: '1' }, key, '127.0.0.1', {});
  expect(list).toEqual({ academy_id: 1, branches: [
    { id: 3, name: '수성', status: 'active', classes: [{ id: 8, name: '정시반', status: 'active' }, { id: 9, name: '수시반', status: 'active' }] },
    { id: 5, name: '칠곡', status: 'active', classes: [] },
  ] });
  repository.branches.mockClear();
  await expect(service.branches({ academy_id: '2' }, key, '127.0.0.1', {})).rejects.toMatchObject({ status: 403 });
  await expect(service.branches({ academy_id: '1', x: '1' }, key, '127.0.0.1', {})).rejects.toMatchObject({ status: 422 });
  await expect(service.branches({ academy_id: '1' }, 'wrong', '127.0.0.1', {})).rejects.toMatchObject({ status: 401 });
  expect(repository.branches).not.toHaveBeenCalled();
});
