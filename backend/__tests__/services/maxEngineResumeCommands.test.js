jest.mock('../../config/database', () => ({}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../../repositories/maxEngineResumeRepository', () => ({ state: jest.fn().mockResolvedValue({ credits: [], payments: [], schedules: [], attendance: [] }) }));
const service = require('../../services/maxEngineResumeCommands');
const { digest } = require('../../services/maxEngineFullSecurity');
const student = { id: 1, academy_id: 1, status: 'paused', rest_start_date: '2026-10-01' };
test('implicit today changes at Korea midnight, explicit resume date stays bound', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-17T14:59:59Z'));
  try {
    const command = { changes: {} };
    const first = await service.state({}, student, command, false);
    expect(first.resumeDate).toBe('2026-10-17');
    jest.setSystemTime(new Date('2026-10-17T15:00:01Z'));
    const next = await service.state({}, student, command, false);
    expect(next.resumeDate).toBe('2026-10-18'); expect(digest(next)).not.toBe(digest(first));
    const explicit = await service.state({}, student, { changes: { resume_date: '2026-10-17' } }, false);
    expect(digest(explicit)).toBe(digest(first));
  } finally { jest.useRealTimers(); }
});
