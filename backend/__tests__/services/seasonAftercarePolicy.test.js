const { validateSeasonAftercare } = require('../../services/seasonAftercarePolicy');

describe('season aftercare policy', () => {
    test('기존 시즌은 후처리 설정이 없어도 현재 동작을 유지한다', () => {
        expect(validateSeasonAftercare({
            seasonEndDate: '2026-09-30', freeLessonEndDate: null, postFreeAction: null,
        })).toBeNull();
    });

    test('신규 시즌은 후처리 설정을 반드시 지정한다', () => {
        expect(validateSeasonAftercare({
            seasonEndDate: '2026-09-30', freeLessonEndDate: null, postFreeAction: null,
        }, { required: true })).toContain('무료 수업 종료일');
    });

    test('수시 종료 후 11월 말까지 무료이고 다음 날 졸업하도록 설정한다', () => {
        expect(validateSeasonAftercare({
            seasonEndDate: '2026-09-30', freeLessonEndDate: '2026-11-30', postFreeAction: 'graduate',
        })).toBeNull();
    });

    test.each([
        [{ seasonEndDate: '2026-09-30', freeLessonEndDate: '2026-09-29', postFreeAction: 'graduate' }, '무료 수업 종료일'],
        [{ seasonEndDate: '2026-09-30', freeLessonEndDate: '2026-11-31', postFreeAction: 'graduate' }, '무료 수업 종료일'],
        [{ seasonEndDate: '2026-09-30', freeLessonEndDate: '2026-11-30', postFreeAction: null }, '종료 후 처리'],
        [{ seasonEndDate: '2026-09-30', freeLessonEndDate: null, postFreeAction: 'graduate' }, '무료 수업 종료일'],
    ])('불완전한 설정은 거부한다', (policy, expectedMessage) => {
        expect(validateSeasonAftercare(policy)).toContain(expectedMessage);
    });
});
