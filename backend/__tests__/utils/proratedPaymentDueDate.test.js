const {
    getKoreaDateText,
    resolveProratedPaymentDueDate,
} = require('../../utils/proratedPaymentDueDate');

describe('resolveProratedPaymentDueDate', () => {
    test('신규생 첫 달 일할 청구는 등록일을 납부기한으로 사용한다', () => {
        expect(resolveProratedPaymentDueDate('2026-07-20')).toBe('2026-07-20');
    });

    test('휴원 복귀 일할 청구는 복귀일을 납부기한으로 사용한다', () => {
        expect(resolveProratedPaymentDueDate('2026-08-03')).toBe('2026-08-03');
    });

    test('한국 자정 이후 등록은 UTC 전날이 아닌 한국 날짜를 사용한다', () => {
        const koreaMidnight = new Date('2026-07-19T15:30:00.000Z');
        expect(getKoreaDateText(koreaMidnight)).toBe('2026-07-20');
    });

    test.each([null, undefined, '', '2026-02-30', 'not-a-date'])(
        '유효하지 않은 시작일 %p은 거부한다',
        (startDate) => {
            expect(() => resolveProratedPaymentDueDate(startDate)).toThrow('유효한 청구 시작일이 필요합니다.');
        }
    );
});
