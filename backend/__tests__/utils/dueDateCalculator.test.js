const { calculateDueDate } = require('../../utils/dueDateCalculator');

describe('calculateDueDate', () => {
    // 기본 동작
    test('납부일이 출석요일이면 그 날짜 반환', () => {
        // 2026-03-02 = 월요일
        expect(calculateDueDate(2026, 3, 2, [1, 3, 5])).toBe('2026-03-02');
    });

    test('납부일 다음 출석일 반환', () => {
        // 2026-03-01 = 일요일, 출석일 월수금 → 3/2 월요일
        expect(calculateDueDate(2026, 3, 1, [1, 3, 5])).toBe('2026-03-02');
    });

    test('납부일 이후 가장 가까운 출석일 반환', () => {
        // 2026-03-03 = 화요일, 출석일 목토 → 3/5 목요일
        expect(calculateDueDate(2026, 3, 3, [4, 6])).toBe('2026-03-05');
    });

    // 월말 처리
    test('2월 납부일 31일 → 28일로 조정 (평년)', () => {
        // 2026년 2월은 28일까지
        expect(calculateDueDate(2026, 2, 31, [])).toBe('2026-02-28');
    });

    test('2월 납부일 30일 → 28일로 조정 후 출석일 탐색', () => {
        // 2026-02-28 = 토요일, 출석일 [1]=월 → 3/2 월요일 (월 넘어감)
        expect(calculateDueDate(2026, 2, 30, [1])).toBe('2026-03-02');
    });

    test('윤년 2월 29일 처리', () => {
        // 2028-02-29 = 화요일
        expect(calculateDueDate(2028, 2, 29, [2])).toBe('2028-02-29');
    });

    // classDays 없는 경우
    test('classDays 빈 배열이면 납부일 그대로', () => {
        expect(calculateDueDate(2026, 3, 15, [])).toBe('2026-03-15');
    });

    test('classDays null이면 납부일 그대로', () => {
        expect(calculateDueDate(2026, 3, 15, null)).toBe('2026-03-15');
    });

    test('classDays undefined이면 납부일 그대로', () => {
        expect(calculateDueDate(2026, 3, 15, undefined)).toBe('2026-03-15');
    });

    // 날짜 포맷
    test('월/일 한자리수 앞에 0 패딩', () => {
        expect(calculateDueDate(2026, 1, 5, [])).toBe('2026-01-05');
    });

    // 요일 경계
    test('토요일 출석 → 토요일 납부일', () => {
        // 2026-03-07 = 토요일
        expect(calculateDueDate(2026, 3, 7, [6])).toBe('2026-03-07');
    });

    test('일요일 출석, 납부일 월요일 → 다음 일요일', () => {
        // 2026-03-02 = 월요일, 출석일 [0]=일요일 → 3/8 일요일
        expect(calculateDueDate(2026, 3, 2, [0])).toBe('2026-03-08');
    });

    // 7일 내 출석일 없는 경우 (매우 드뭄)
    test('7일 내 출석일 없으면 납부일 그대로 반환', () => {
        // 이론적으로 불가능 (7일이면 모든 요일 포함)하지만 로직 확인
        // 실제로는 7일 span이면 항상 매칭됨
        expect(calculateDueDate(2026, 3, 1, [0, 1, 2, 3, 4, 5, 6])).toBe('2026-03-01');
    });

    // 월 경계 넘어가는 케이스
    test('월말 납부일 + 출석일이 다음달로 넘어감', () => {
        // 2026-01-31 = 토요일, 출석일 [1]=월요일 → 2/2 월요일
        expect(calculateDueDate(2026, 1, 31, [1])).toBe('2026-02-02');
    });

    test('12월 31일 → 다음 해 1월로 넘어감', () => {
        // 2026-12-31 = 목요일, 출석일 [5]=금요일 → 2027-01-01
        expect(calculateDueDate(2026, 12, 31, [5])).toBe('2027-01-01');
    });
});
