// 학생 잠금(SELECT … FOR UPDATE)은 실제 MySQL 시험(integration/pending-bill-mysql)에서 확인 — 여기선 호출 순서만 본다
jest.mock('../../repositories/studentBillingLock', () => ({ lockStudentForBilling: jest.fn().mockResolvedValue({ id: 1 }) }));
jest.mock('node-cron', () => ({
    schedule: jest.fn(),
}));

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../services/seasonGraduationService', () => ({
    graduateDueSeasonStudents: jest.fn().mockResolvedValue(0),
}));

const db = require('../../config/database');
const { graduateDueSeasonStudents } = require('../../services/seasonGraduationService');
const { generateMonthlyPayments } = require('../../scheduler/paymentScheduler');

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-25T09:00:00+09:00'));
    db.query.mockReset().mockResolvedValue([[]]);
    db.getConnection.mockReset();
    graduateDueSeasonStudents.mockReset().mockResolvedValue(0);
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
        expect(studentSql).toContain('se.free_lesson_end_date');
        expect(studentSql).toContain("se.post_free_action = 'graduate'");
        expect(studentParams).toEqual([5, 5, '2026-06', ...Array(7).fill('2026-06')]);
        expect(graduateDueSeasonStudents).toHaveBeenCalledWith('2026-06-01');
        expect(db.getConnection).not.toHaveBeenCalled();
        // 시즌으로 빠진 학생의 비시즌 종강 일할 대상 조회 (services/nonSeasonProratedBilling)
        const [proratedSql, proratedParams] = db.query.mock.calls[2];
        expect(proratedSql).toContain('ss.prorated_month = ?');
        expect(proratedParams.slice(0, 3)).toEqual([5, '2026-06', '2026-06']);
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
        expect(studentParams).toEqual([10, 7, '2026-06', ...Array(7).fill('2026-06')]);
    });

    test('졸업 처리 실패 시 월 청구를 시작하지 않는다', async () => {
        graduateDueSeasonStudents.mockRejectedValueOnce(new Error('DB unavailable'));
        await expect(generateMonthlyPayments()).rejects.toThrow('DB unavailable');
        expect(db.query).not.toHaveBeenCalled();
    });
});

describe('payment scheduler 같은 달 미납 청구 다시 쓰기', () => {
    function mockStudentWithExisting(existingRow) {
        db.query
            .mockResolvedValueOnce([[{ academy_id: 5, default_due_day: 5 }]])
            .mockResolvedValueOnce([[{ id: 7, name: 'enc_홍', monthly_tuition: 450000, discount_rate: 0, class_days: '[1,3]', due_day: 5 }]]);
        const connection = {
            beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
            query: jest.fn()
                .mockResolvedValueOnce([[existingRow]])
                .mockResolvedValue([[]]),
        };
        jest.spyOn(console, 'log').mockImplementation(() => {});
        db.getConnection.mockResolvedValue(connection);
        return connection;
    }

    test('추가 금액이 있는 미납 청구를 다시 돌리면 추가 금액을 최종 금액에 넣는다(예전엔 빠졌다)', async () => {
        const connection = mockStudentWithExisting({ id: 70, payment_status: 'pending', additional_amount: '10000.00', carryover_amount: '0.00', rest_credit_id: null, notes: null });

        await generateMonthlyPayments();

        const update = connection.query.mock.calls.find(([sql]) => /UPDATE student_payments SET/.test(sql));
        // UPDATE 는 추가 금액 칸을 건드리지 않는다 → 그대로 남는다
        expect(update[0]).not.toContain('additional_amount');
        // [base, discount, carryover, rest_credit_id, final, ...] — 450,000 + 10,000
        expect(update[1].slice(0, 5)).toEqual([450000, 0, 0, null, 460000]);
    });

    test('크레딧과 추가 금액이 있는 미납 청구는 공통 식(크레딧 빼고 천원 절삭)으로 최종 금액을 낸다', async () => {
        const { monthlyBillAmounts } = require('../../utils/monthlyBillAmounts');
        const connection = mockStudentWithExisting({ id: 70, payment_status: 'pending', additional_amount: '10000.00', carryover_amount: '166500.00', rest_credit_id: 9, notes: '[크레딧 차감]' });

        await generateMonthlyPayments();

        const update = connection.query.mock.calls.find(([sql]) => /UPDATE student_payments SET/.test(sql));
        // 450,000 + 10,000 − 166,500 = 293,500 → 293,000
        expect(update[1].slice(0, 5)).toEqual([450000, 0, 166500, 9, 293000]);
        expect(update[1][4]).toBe(monthlyBillAmounts(450000, 0, 10000, 166500).final);
        // 이미 적용된 크레딧이 있으니 크레딧을 또 빼지 않는다
        expect(connection.query.mock.calls.some(([sql]) => /rest_credits/.test(sql))).toBe(false);
    });
});
