jest.mock('../../config/database', () => ({}));
jest.mock('../../repositories/maxEngineSyncRepository', () => ({ seasons: jest.fn(), studentSeasons: jest.fn(), SEASON_PAGE_SIZE: 1000 }));
jest.mock('../../repositories/maxEngineRepository', () => ({ userById: jest.fn() }));
const crypto = require('crypto');
process.env.DATA_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString('hex');  // 암호화 모듈 불러올 때 경고 없게
const repository = require('../../repositories/maxEngineSyncRepository');
const service = require('../../services/maxEngineSyncService');
const key = crypto.randomBytes(32).toString('hex');
const original = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  process.env.MAX_ENGINE_SYNC_KEY = key;
  process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1';
});
afterAll(() => { process.env = original; });
const read = (query, supplied = key, socket = '127.0.0.1', headers = {}) => service.seasons(query, supplied, socket, headers);
const season = { id: 31, academy_id: 1, season_name: '2027 정시 시즌', season_type: 'regular', status: 'active', season_start_date: '2026-10-01',
  season_end_date: '2027-02-28', non_season_end_date: '2026-09-30', default_season_fee: 1000000, operating_days: '[1,3,5]' };

test('same key, internal-only and academy allowlist as student sync; nothing reaches the DB otherwise', async () => {
  delete process.env.MAX_ENGINE_SYNC_KEY;
  await expect(read({ academy_id: '1' })).rejects.toMatchObject({ status: 503, code: 'SYNC_DISABLED' });
  process.env.MAX_ENGINE_SYNC_KEY = key;
  await expect(read({ academy_id: '1' }, 'wrong')).rejects.toMatchObject({ status: 401, code: 'SYNC_UNAUTHORIZED' });
  await expect(read({ academy_id: '1' }, key, '10.0.0.5')).rejects.toMatchObject({ status: 403, code: 'SYNC_INTERNAL_ONLY' });
  await expect(read({ academy_id: '1' }, key, '127.0.0.1', { 'x-forwarded-for': '1.2.3.4' })).rejects.toMatchObject({ status: 403 });
  await expect(read({ academy_id: '2' })).rejects.toMatchObject({ status: 403, code: 'SYNC_ACADEMY_FORBIDDEN' });
  for (const query of [{}, { academy_id: '0' }, { academy_id: '1', name: 'x' }, { academy_id: '1', paca_student_id: '-1' }, { academy_id: '1', offset: 'x' }]) {
    await expect(read(query)).rejects.toMatchObject({ status: 422, code: 'SYNC_INVALID_QUERY' });
  }
  expect(repository.seasons).not.toHaveBeenCalled();
});

test('exports only season dates and registration state — no names, phones or fees', async () => {
  repository.seasons.mockResolvedValue([season]);
  repository.studentSeasons.mockResolvedValue([{ id: 9, season_id: 31, student_id: 501, registration_date: '2026-09-20', payment_status: 'paid',
    is_cancelled: 0, season_fee: 1000000, notes: 'private', name: 'ENC:x' }]);
  const result = await read({ academy_id: '1', paca_student_id: '501' });
  expect(result).toEqual({ academy_id: 1, next_offset: null,
    seasons: [{ id: 31, season_name: '2027 정시 시즌', season_type: 'regular', status: 'active', season_start_date: '2026-10-01',
      season_end_date: '2027-02-28', non_season_end_date: '2026-09-30' }],
    student_seasons: [{ season_id: 31, paca_student_id: 501, registration_date: '2026-09-20', payment_status: 'paid', is_cancelled: false }] });
  expect(repository.seasons).toHaveBeenCalledWith(1);
  expect(repository.studentSeasons).toHaveBeenCalledWith(1, [31], 501, 0);
});

test('registrations paginate with next_offset; no seasons means no registration query', async () => {
  repository.seasons.mockResolvedValue([season]);
  repository.studentSeasons.mockResolvedValue(Array.from({ length: 1001 }, (_, i) => ({ id: i + 1, season_id: 31, student_id: i + 1, is_cancelled: 0 })));
  const first = await read({ academy_id: '1' });
  expect(first.student_seasons).toHaveLength(1000);
  expect(first.next_offset).toBe(1000);
  expect(repository.studentSeasons).toHaveBeenLastCalledWith(1, [31], null, 0);
  repository.studentSeasons.mockResolvedValue([]);
  expect((await read({ academy_id: '1', offset: '1000' })).next_offset).toBeNull();
  expect(repository.studentSeasons).toHaveBeenLastCalledWith(1, [31], null, 1000);
  repository.seasons.mockResolvedValue([]);
  repository.studentSeasons.mockClear();
  expect(await read({ academy_id: '1' })).toEqual({ academy_id: 1, seasons: [], student_seasons: [], next_offset: null });
  expect(repository.studentSeasons).not.toHaveBeenCalled();
});
