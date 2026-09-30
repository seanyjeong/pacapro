jest.mock('../../config/database', () => ({ execute: jest.fn() }));
jest.mock('../../config/peak-database', () => ({ execute: jest.fn() }));
const paca = require('../../config/database');
const peak = require('../../config/peak-database');
const { all } = require('../../services/maxEngineReadRows');
const { validate, period } = require('../../services/maxEngineWorkflowInput');
beforeEach(() => { jest.resetAllMocks(); });
test('oversized source scope fails explicitly rather than returning an incomplete summary', async () => {
  paca.execute.mockImplementation(async (_sql, params) => [Array.from({ length: 1001 }, (_, i) => ({ id: params[1] + i + 1, name: 'Synthetic' }))]);
  await expect(all({ academy_id: 1 }, 'paca', 'students', {}, { columns: ['id', 'name'] })).rejects.toMatchObject({ code: 'QUERY_TOO_BROAD' });
  expect(paca.execute).toHaveBeenCalledTimes(10);
});
test('empty visible PEAK page still advances to owned records on next page', async () => {
  peak.execute.mockResolvedValueOnce([Array.from({ length: 1001 }, (_, i) => ({ id: i + 1, __paca_student_id: 90 }))])
    .mockResolvedValueOnce([[{ id: 1001, __paca_student_id: 1 }]]);
  paca.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{ id: 1 }]]);
  expect(await all({ academy_id: 1 }, 'peak', 'students', {}, { columns: ['id'] })).toEqual([{ id: 1001 }]);
  expect(peak.execute.mock.calls[1][1]).toEqual([1, 1000]);
});
test('validation rejects mixed/invalid scopes while periods include both KST dates', () => {
  expect(validate('paca', 'student_search', { name: ' 김학생 ' })).toEqual({ name: '김학생' });
  expect(period({ date: '2026-09-27' })).toEqual({ start_date: '2026-09-27', end_date: '2026-09-27' });
  for (const p of [null, [], { academy_id: 2 }, { date: '2026-09-27', start_date: '2026-09-01', end_date: '2026-09-27' }, { start_date: '2026-09-01' }]) {
    expect(() => validate('paca', 'attendance_summary', p)).toThrow();
  }
  expect(() => validate('peak', '__proto__', {})).toThrow();
});
