const {
    calculateResumePayment, calculateSameMonthAdjustment, processResumePayment, normalizeResumeClassDays,
} = require('../../services/resumePaymentService');

const student = { id: 3, academy_id: 2, monthly_tuition: 310000, discount_rate: 0, rest_start_date: '2026-10-11' };
const shortened = { id: 9, base_amount: 310000, final_amount: 100000, paid_amount: 0 };

test('이전 한글 요일 형식도 청구와 출결에 같은 숫자 요일로 전달한다', () => {
    expect(normalizeResumeClassDays('["월","금"]')).toEqual([1, 5]);
});

test('휴원 당일 복귀는 원래 청구의 천원 미만 금액도 복원한다', () => {
    expect(calculateSameMonthAdjustment({ ...shortened, base_amount: 310550 }, student,
        '2026-10-11', null)).toBe(310550);
});

test('같은 달 휴원 전 10일 + 복귀일 21일부터 11일의 청구를 복원한다', () => {
    expect(calculateSameMonthAdjustment(shortened, student, '2026-10-21', null)).toBe(210000);
});

test('납부액 하한 때문에 휴원 때 paid로 바뀐 청구도 납부액을 빼먹거나 중복 가산하지 않는다', () => {
    const payment = { ...shortened, paid_amount: 150000, final_amount: 150000, payment_status: 'paid' };
    expect(calculateSameMonthAdjustment(payment, student, '2026-10-21', null)).toBe(210000);
});

test('월 전체 청구는 실제 휴원 크레딧만 재계산하고 중복 청구하지 않는다', () => {
    expect(calculateSameMonthAdjustment({ ...shortened, final_amount: 310000 }, student,
        '2026-10-21', { creditAmount: 100000 })).toBeNull();
});

test.each([
    [{ ...shortened, final_amount: 90000 }, null],
    [shortened, { creditAmount: 100000 }],
    [{ ...shortened, carryover_amount: 10000 }, null],
])('별도 조정이나 크레딧이 겹치는 축소 청구는 추측하여 변경하지 않는다', (payment, credit) => {
    expect(() => calculateSameMonthAdjustment(payment, student, '2026-10-21', credit)).toThrow('정산 내역');
});

test('할인된 월청구에도 휴원 때와 같은 달력 일수 기준을 적용한다', () => {
    const payment = { ...shortened, discount_amount: 31000, final_amount: 90000 };
    expect(calculateSameMonthAdjustment(payment, student, '2026-10-21', null)).toBe(189000);
});

test('없는 청구는 기존 수업요일 기준과 할인 절삭 순서로 계산한다', () => {
    expect(calculateResumePayment({ ...student, monthly_tuition: 300000, discount_rate: 10 },
        '2026-10-21', [{ day: 1 }, { day: 5 }])).toMatchObject({
        remainingClassDays: 3, totalClassDays: 8, baseAmount: 112000,
        discountAmount: 11000, finalAmount: 101000, dueDate: '2026-10-21',
    });
});

test('1일 복귀는 월정액 상한을 유지한다', () => {
    expect(calculateResumePayment(student, '2026-10-01', [1, 5]).finalAmount).toBe(310000);
});

test('다른 달의 기존 청구는 변경하지 않는다', async () => {
    const connection = { execute: jest.fn().mockResolvedValue([[shortened]]) };
    expect(await processResumePayment({ connection, student, resumeDate: '2026-11-02', classDays: [1] })).toEqual({});
    expect(connection.execute).toHaveBeenCalledTimes(1);
});

test('같은 달 축소 청구를 학원과 학생 범위 내에서 변경하고 납부액은 보존한다', async () => {
    const connection = { execute: jest.fn().mockResolvedValueOnce([[shortened]]).mockResolvedValue([{ affectedRows: 1 }]) };
    expect(await processResumePayment({ connection, student, resumeDate: '2026-10-21', classDays: [1] }))
        .toEqual({ paymentAdjusted: { id: 9, yearMonth: '2026-10', previousAmount: 100000, finalAmount: 210000 } });
    const [sql, params] = connection.execute.mock.calls[1];
    expect(sql).toContain('is_prorated = 1');
    expect(sql).not.toMatch(/SET\s+paid_amount\s*=/);
    expect(params.slice(-3)).toEqual([9, 3, 2]);
});
