/**
 * 청구액을 직접 정한 청구를 다른 흐름이 덮거나, 시즌 청구가 두 번 깎이거나, 받은 돈 기록이 지워지지 않는지.
 */
jest.mock('../../config/database', () => ({ execute: jest.fn(), query: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { isDirectlyPriced } = require('../../utils/directBillAmount');
const { planSeasonEnrollmentUpdate } = require('../../services/seasonEnrollmentUpdateService');
const { updated } = require('../../services/maxEngineFullPayments');

const season = { season_name: 'S', season_start_date: '2026-11-23', season_end_date: '2027-01-29', operating_days: '[1,2,3,4,5]', default_season_fee: '3700000.00', continuous_discount_type: 'none' };
const enrollment = { registration_date: '2026-11-20', discount_amount: '0.00', is_continuous: 0, previous_season_id: null };
const bill = {
    id: 1, year_month: '2026-11', base_amount: '3700000.00', discount_amount: '0.00', additional_amount: '0.00', carryover_amount: 0,
    final_amount: '3500000.00', paid_amount: '0.00', payment_status: 'pending', notes: '청구액 직접 수정: 3,700,000원 → 3,500,000원'
};
const plan = (bills, changes) => planSeasonEnrollmentUpdate({ enrollment, season, student: {}, bills, changes });

test('직접 정한 청구 = 메모 기록이 있고 금액이 계산식과 다른 청구', () => {
    expect(isDirectlyPriced(bill)).toBe(true);
    expect(isDirectlyPriced({ ...bill, notes: null })).toBe(false);
    expect(isDirectlyPriced({ ...bill, final_amount: '3700000.00' })).toBe(false);
});

test('시즌 등록 수정: 직접 정한 미납 청구의 금액을 다시 계산해 덮지 않는다', () => {
    expect(plan([bill], { registration_date: '2026-11-21' }).conflict).toContain('청구액을 직접 정한');
    expect(plan([bill], { season_fee: 3600000 }).conflict).toContain('청구액을 직접 정한');
    // 직접 정하지 않은 미납 청구는 전처럼 다시 계산한다
    const plain = plan([{ ...bill, notes: null, final_amount: '3700000.00' }], { season_fee: 3600000 });
    expect(plain.conflict).toBeNull();
    expect(plain.plan.finalSeasonFee).toBe(3600000);
    // 시간대·할인 사유는 그대로 바꿀 수 있다
    expect(plan([bill], { discount_reason: 'x' }).conflict).toBeNull();
});

test('AI 연결: 일할·할인이 든 시즌 청구의 추가 금액은 바꿀 수 없다(3,322,000원으로 두 번 깎이던 것)', () => {
    const prorated = { ...bill, payment_type: 'season', additional_amount: '189000.00', final_amount: '3511000.00', notes: null, student_status: 'active' };
    expect(() => updated({ additional_amount: '0', notes: 'x' }, prorated)).toThrow('청구액을 직접 입력해 주세요.');
    // 따로 정한 월 청구의 추가 금액은 전처럼 바꾼 만큼
    const paused = { ...prorated, payment_type: 'monthly', base_amount: '450000.00', additional_amount: '0.00', final_amount: '225000.00' };
    expect(updated({ additional_amount: '10000', notes: 'x' }, paused).final_amount).toBe('235000.00');
});
