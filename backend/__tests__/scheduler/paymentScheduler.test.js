jest.mock('node-cron', () => ({
    schedule: jest.fn(),
}));

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getConnection: jest.fn(),
}));

const db = require('../../config/database');
const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-25T09:00:00+09:00'));
    db.query.mockReset();
    db.getConnection.mockReset();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('payment scheduler season monthly policy', () => {
    test('시즌별 대체 정책은 해당 학생을 월납부 자동 생성 대상에서 제외한다', async () => {
        db.query
            .mockResolvedValueOnce([[{
                academy_id: 5,
                default_due_day: 5,
            }]])
            .mockResolvedValueOnce([[]]);

        await generateMonthlyPayments();

        const [studentSql, studentParams] = db.query.mock.calls[1];
        expect(studentSql).toContain('NOT EXISTS');
        expect(studentSql).toContain('student_seasons');
        expect(studentSql).toContain('seasons');
        expect(studentSql).toContain("COALESCE(se.season_monthly_policy, 'season_replaces_monthly')");
        expect(studentParams).toEqual([5, 5, '2026-06', '2026-06']);
        expect(db.getConnection).not.toHaveBeenCalled();
    });

    test('함께 청구 시즌은 시즌 row 정책으로만 판정한다', async () => {
        db.query
            .mockResolvedValueOnce([[{
                academy_id: 7,
                default_due_day: 10,
            }]])
            .mockResolvedValueOnce([[]]);

        await generateMonthlyPayments();

        const [studentSql, studentParams] = db.query.mock.calls[1];
        expect(studentSql).not.toContain("? = 'season_plus_monthly'");
        expect(studentSql).toContain("= 'season_replaces_monthly'");
        expect(studentParams).toEqual([10, 7, '2026-06', '2026-06']);
    });
});
