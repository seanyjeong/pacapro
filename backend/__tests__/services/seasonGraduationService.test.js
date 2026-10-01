jest.mock('../../repositories/seasonGraduationRepository', () => ({ graduateDueStudents: jest.fn() }));

const { graduateDueStudents } = require('../../repositories/seasonGraduationRepository');
const { graduateDueSeasonStudents } = require('../../services/seasonGraduationService');

beforeEach(() => graduateDueStudents.mockReset().mockResolvedValue(2));

test('무료 종료 다음 날 졸업 대상 처리를 위임한다', async () => {
    await expect(graduateDueSeasonStudents('2026-12-01')).resolves.toBe(2);
    expect(graduateDueStudents).toHaveBeenCalledWith('2026-12-01');
});

test('잘못된 기준일에는 학생 상태를 바꾸지 않는다', async () => {
    await expect(graduateDueSeasonStudents('2026-11-31')).rejects.toThrow();
    expect(graduateDueStudents).not.toHaveBeenCalled();
});
