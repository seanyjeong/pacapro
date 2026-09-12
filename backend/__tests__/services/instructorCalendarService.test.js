jest.mock('../../config/database', () => ({}));
jest.mock('../../utils/encryption', () => ({ decrypt: value => value }));
const { getCalendarPeriod } = require('../../services/instructorCalendarService');

test('월 조회 범위는 다음 달 첫날 직전까지다', () => {
    expect(getCalendarPeriod('2026', '12')).toEqual({
        yearMonth: '2026-12', startDate: '2026-12-01', endDate: '2027-01-01',
    });
    expect(getCalendarPeriod('2028', '2')).toEqual({
        yearMonth: '2028-02', startDate: '2028-02-01', endDate: '2028-03-01',
    });
});

test.each([[1999, 1], [2101, 1], [2026, 0], [2026, 13], [2026, 1.5], [null, 1]])('허용 범위 밖의 기간은 거부한다: %j', (year, month) => {
    expect(getCalendarPeriod(year, month)).toBeNull();
});
