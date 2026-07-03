/**
 * onboardingService 회귀 테스트
 */

jest.mock('../../config/database', () => ({
    getConnection: jest.fn()
}));

const db = require('../../config/database');
const onboardingService = require('../../services/onboardingService');

function createConnection() {
    return {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([{}]),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn()
    };
}

describe('onboardingService.complete', () => {
    beforeEach(() => {
        db.getConnection.mockReset();
    });

    test('온보딩 학원비를 설정 화면과 같은 weekly_N 키로 저장한다', async () => {
        const connection = createConnection();
        db.getConnection.mockResolvedValue(connection);

        await onboardingService.complete(7, {
            academy_name: '테스트학원',
            phone: '010-0000-0000',
            address: '서울',
            business_number: '123-45-67890',
            morning_class_time: '09:30-12:00',
            afternoon_class_time: '14:00-18:00',
            evening_class_time: '18:30-21:00',
            salary_payment_day: 10,
            salary_month_type: 'next',
            tuition_due_day: 5,
            tuition_settings: {
                exam_tuition: { '1': 110000, '2': 220000 },
                adult_tuition: { '1': 90000, weekly_2: 180000 },
                season_fees: { exam_early: 700000 }
            }
        });

        const settingsJson = connection.query.mock.calls[1][1][6];
        const settings = JSON.parse(settingsJson);

        expect(settings.exam_tuition).toMatchObject({
            weekly_1: 110000,
            weekly_2: 220000
        });
        expect(settings.adult_tuition).toMatchObject({
            weekly_1: 90000,
            weekly_2: 180000
        });
        expect(settings.season_fees).toEqual({
            exam_early: 700000,
            exam_regular: 0,
            civil_service: 0
        });
        expect(settings.exam_tuition).not.toHaveProperty('1');
    });
});
