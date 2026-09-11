jest.mock('../../config/database', () => ({}));
const { consultationSlots } = require('../../services/academyEventService');

describe('일정의 상담 차단 시간대', () => {
    test('선택하지 않은 일정과 휴일은 상담을 차단하지 않는다', () => {
        expect(consultationSlots({ block_consultation: false, is_all_day: true })).toEqual([]);
        expect(consultationSlots({ block_consultation: false, is_holiday: true })).toEqual([]);
    });

    test('선택한 종일 일정과 휴일은 하루를 차단한다', () => {
        const slots = ['morning', 'afternoon', 'evening'];
        expect(consultationSlots({ block_consultation: true, is_all_day: true })).toEqual(slots);
        expect(consultationSlots({ block_consultation: true, is_holiday: true })).toEqual(slots);
    });

    test.each([
        ['09:00', '12:00', ['morning']],
        ['13:00', '18:00', ['afternoon']],
        ['18:00', '21:00', ['evening']],
        ['11:00', '18:01', ['morning', 'afternoon', 'evening']],
        ['12:00:00', '18:00:00', ['afternoon']]
    ])('%s부터 %s까지 포함된 시간대만 차단한다', (start_time, end_time, expected) => {
        expect(consultationSlots({ block_consultation: true, start_time, end_time })).toEqual(expected);
    });
});
