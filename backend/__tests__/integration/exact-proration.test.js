/**
 * 일할·시즌·환불·크레딧 금액의 소수 곱셈 오차 없애기 — 식 구조·절삭 위치는 그대로, 곱셈·나눗셈만 정확히.
 * (a) 정확한 계산 도우미(utils/monthlyBillAmounts)가 넓은 범위에서 BigInt 기대값과 같다.
 * (b) 경로마다 예전 식이 틀리던 입력을 범위 탐색으로 찾아, 실제 경로 코드가 이제 정확한 값을 내는지 고정한다.
 */
jest.mock('../../config/database', () => ({
    query: (...args) => global.__exactDb.query(...args),
    execute: (...args) => global.__exactDb.execute(...args),
    getConnection: (...args) => global.__exactDb.getConnection(...args),
}));
jest.mock('../../middleware/auth', () => ({
    verifyToken: (req, res, next) => { req.user = { academyId: 1, userId: 10, role: 'owner' }; next(); },
    checkPermission: () => (req, res, next) => next(),
    requireRole: () => (req, res, next) => next(),
}));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { floorRatio, floorPercent, floorAfterPercent, exactPercent } = require('../../utils/monthlyBillAmounts');
const { calculateResumePayment } = require('../../services/resumePaymentService');
const { planSeasonEnrollment } = require('../../services/seasonEnrollmentService');
const { calculateMidSeasonFee, calculateProRatedFee, calculateSeasonRefund } = require('../../utils/seasonCalculator');
const { recalculateEnrollmentPayment, createActivationPayment } = require('../../routes/students/crud/update/paymentEffects');

// --- BigInt 정확한 기대값 (금액은 원·전, 비율은 0.01% 단위) ---
const h = value => BigInt(Math.round(value * 100));
const floorBig = (a, b) => (a >= 0n ? a / b : -((-a + b - 1n) / b));
const exRatio = (amount, n, d, unit = 1000) => Number(floorBig(h(amount) * BigInt(n), BigInt(d) * 100n * BigInt(unit)) * BigInt(unit));
const exPct = (amount, rate, unit = 1000) => Number(floorBig(h(amount) * h(rate), 1000000n * BigInt(unit)) * BigInt(unit));
const exAfter = (amount, rate, unit = 1000) => Number(floorBig(h(amount) * (10000n - h(rate)), 1000000n * BigInt(unit)) * BigInt(unit));
const t = (x, unit = 1000) => Math.floor(x / unit) * unit;
const RATES_2DP = Array.from({ length: 10001 }, (_, i) => i / 100);

describe('(a) 정확한 계산 도우미 = BigInt 기대값', () => {
    test('floorRatio: 금액 1,000~2,000,000(1,000 단위) × 분모 1~31 × 분자 0~분모, 천원·원 단위', () => {
        const wrong = [];
        for (let b = 1000; b <= 2000000; b += 1000) for (let d = 1; d <= 31; d++) for (let n = 0; n <= d; n++) {
            if (floorRatio(b, n, d) !== exRatio(b, n, d)) wrong.push([b, n, d, 1000]);
            if (floorRatio(b, n, d, 1) !== exRatio(b, n, d, 1)) wrong.push([b, n, d, 1]);
        }
        expect(wrong).toEqual([]);
    });

    test('floorPercent·floorAfterPercent: 정수 비율 × 금액 1,000~2,000,000, 소수 둘째 자리 비율 × 금액 1,000~100,000', () => {
        const wrong = [];
        const check = (x, r) => {
            if (floorPercent(x, r) !== exPct(x, r)) wrong.push(['pct', x, r]);
            if (floorPercent(x, r, 1) !== exPct(x, r, 1)) wrong.push(['pct1', x, r]);
            if (floorAfterPercent(x, r) !== exAfter(x, r)) wrong.push(['after', x, r]);
        };
        for (let x = 1000; x <= 2000000; x += 1000) for (let r = 0; r <= 100; r++) check(x, r);
        for (let x = 1000; x <= 100000; x += 1000) for (const r of RATES_2DP) check(x, r);
        expect(wrong).toEqual([]);
    }, 60000);

    test('전 단위 금액·DB 문자열 값, 절삭 없는 할인액 칸 값', () => {
        expect(floorRatio('333333.33', 7, 13)).toBe(exRatio(333333.33, 7, 13));
        expect(floorPercent('350000.00', '32.80')).toBe(114000);
        expect(exactPercent(125000, 32.8)).toBe(41000);
        expect(exactPercent(138000, 10)).toBe(13800);
    });
});

// 예전 식이 틀리는 (금액, 비율) 첫 입력
function findAmount(oldFn, exactFn, from = 1000, to = 2000000, step = 1000) {
    for (let x = from; x <= to; x += step) if (oldFn(x) !== exactFn(x)) return x;
    return null;
}
function findRate(oldFn, exactFn) {
    for (const r of RATES_2DP) if (oldFn(r) !== exactFn(r)) return r;
    return null;
}
const daysOf = (year, month, weekdays, fromDay) => {
    const last = new Date(year, month, 0).getDate();
    let total = 0, remaining = 0;
    for (let d = 1; d <= last; d++) {
        if (!weekdays.includes(new Date(year, month - 1, d).getDay())) continue;
        total++;
        if (d >= fromDay) remaining++;
    }
    return { total, remaining, last };
};

// 예전 식이 틀리는 (요일·날짜 조합, 금액)을 찾는다. combos: [{ key, n, d }]
function findCombo(combos, oldFn, exactFn) {
    for (const combo of combos) {
        for (let x = 1000; x <= 2000000; x += 1000) {
            if (oldFn(x, combo.n, combo.d) !== exactFn(x, combo.n, combo.d)) return { ...combo, amount: x };
        }
    }
    return null;
}
const WEEKDAY_SETS = [[1, 3, 5], [2, 4], [1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6], [1, 3], [2, 4, 6], [1, 2, 3, 4, 5, 6], [6], [0, 6]];
const KOREAN = ['일', '월', '화', '수', '목', '금', '토'];
// 2026년 12월 등록일 2~28일 × 요일 조합의 (남은 수업일, 전체 수업일)
const enrollCombos = WEEKDAY_SETS.flatMap(weekdays => Array.from({ length: 27 }, (_, i) => i + 2).map(day => {
    const { total, remaining } = daysOf(2026, 12, weekdays, day);
    return { weekdays, day, n: remaining, d: total };
})).filter(c => c.d > 0 && c.n > 0);

describe('(b) 경로별: 예전 식이 틀리던 입력에서 이제 정확한 값', () => {
    test('등록일 일할 청구(POST /payments/generate-prorated): 학원비 × (남은/전체 수업일), 일할 − 일할 × 할인율', async () => {
        const app = express(); app.use(express.json());
        const router = express.Router(); require('../../routes/payments/bulk')(router); app.use('/p', router);
        const call = async (tuition, rate, weekdays, day) => {
            const date = `2026-12-${String(day).padStart(2, '0')}`;
            const student = { id: 1, name: '합성', monthly_tuition: String(tuition), discount_rate: String(rate), payment_due_day: 5,
                enrollment_date: date, class_days: JSON.stringify(weekdays.map(w => KOREAN[w])), tuition_due_day: 5 };
            const inserts = [];
            global.__exactDb = { execute: async (sql, params) => {
                if (/INSERT INTO student_payments/.test(sql)) { inserts.push(params); return [{ insertId: 1 }]; }
                if (/FROM students s/.test(sql)) return [[student]];
                if (/FROM student_payments p/.test(sql)) return [[{ id: 1 }]];
                return [[]];
            } };
            const res = await request(app).post('/p/generate-prorated').send({ student_id: 1, enrollment_date: date });
            expect(res.status).toBe(201);
            return inserts[0]; // student, academy, ym, 일할, 할인액(절삭 없음), 최종, …
        };
        // 일할: 예전 b × (n / d) 가 틀리던 조합
        const combo = findCombo(enrollCombos, (b, n, d) => t(b * (n / d)), (b, n, d) => exRatio(b, n, d));
        expect(combo).not.toBeNull();
        const ratioInsert = await call(combo.amount, 0, combo.weekdays, combo.day);
        expect(ratioInsert[3]).toBe(exRatio(combo.amount, combo.n, combo.d));
        // 최종: 예전 x − x × (r / 100) 가 틀리던 입력(1일 등록 = 일할 없음 → 일할 금액 = 학원비)
        const rate = findRate(r => t(25000 - 25000 * (r / 100)), r => exAfter(25000, r));
        expect(rate).toBe(56);
        const afterInsert = await call(25000, rate, [1, 3, 5], 1);
        expect([afterInsert[3], afterInsert[4], afterInsert[5]]).toEqual([25000, 14000, 11000]);
    });

    test('첫 달 일할 재계산(POST /students/:id/recalculate-first-payment): 학원비 ÷ 전체 × 남은 수업일, 할인 = 일할 × 할인율', async () => {
        const app = express(); app.use(express.json());
        const router = express.Router(); require('../../routes/students/firstPayment')(router); app.use('/s', router);
        const run = async (tuition, rate, weekdays, day) => {
            let update;
            global.__exactDb = { execute: async (sql, params) => {
                if (/FROM students WHERE id/.test(sql)) {
                    return [[{ id: 1, enrollment_date: `2026-12-${String(day).padStart(2, '0')}`, monthly_tuition: tuition,
                        discount_rate: rate, class_days: JSON.stringify(weekdays), time_slot: 'evening' }]];
                }
                if (/is_prorated = 1 OR description/.test(sql)) return [[{ id: 7, payment_status: 'pending', additional_amount: 0, carryover_amount: 0 }]];
                if (/UPDATE student_payments/.test(sql)) { update = params; return [{ affectedRows: 1 }]; }
                return [[]];
            } };
            expect((await request(app).post('/s/1/recalculate-first-payment').send({})).status).toBe(200);
            return update.slice(0, 3); // 일할, 할인, 최종
        };
        const combo = findCombo(enrollCombos, (b, n, d) => t(b / d * n), (b, n, d) => exRatio(b, n, d));
        expect(combo).not.toBeNull();
        expect((await run(combo.amount, 0, combo.weekdays, combo.day))[0]).toBe(exRatio(combo.amount, combo.n, combo.d));
        // 할인: 예전 x × r / 100 가 틀리던 입력(1일 등록 = 일할 금액 = 학원비)
        expect(await run(125000, 32.8, [1, 3, 5], 1)).toEqual([125000, 41000, 84000]);
    });

    test('학생 수정의 등록일 변경 재계산·재원 전환 첫 청구(paymentEffects)', async () => {
        const combo = findCombo(enrollCombos, (b, n, d) => t(b / d * n), (b, n, d) => exRatio(b, n, d));
        const calls = [];
        const pool = { execute: async (sql, params) => {
            calls.push([sql, params]);
            if (/is_prorated = 1 OR description/.test(sql)) return [[{ id: 7, payment_status: 'pending', additional_amount: 0, carryover_amount: 0 }]];
            return [[]];
        } };
        const recalc = async (tuition, rate, weekdays, day) => {
            calls.length = 0;
            await recalculateEnrollmentPayment({ pool, studentId: 1, academyId: 1, enrollmentDate: `2026-12-${String(day).padStart(2, '0')}`,
                oldStudent: { enrollment_date: '2026-11-15' }, // 다른 달에서 옮겨 와 늘 재계산
                updatedStudent: { monthly_tuition: tuition, discount_rate: rate, class_days: JSON.stringify(weekdays) }, currentTimeSlot: 'evening' });
            return calls.find(([sql]) => /UPDATE student_payments/.test(sql))[1].slice(3, 6);
        };
        expect((await recalc(combo.amount, 0, combo.weekdays, combo.day))[0]).toBe(exRatio(combo.amount, combo.n, combo.d));
        expect(await recalc(125000, 32.8, [1, 3, 5], 1)).toEqual([125000, 41000, 84000]);

        // 재원 전환 첫 청구: 학원비 × 남은 / 전체 (예전 식도 정수 금액에선 맞았다), 할인 = 일할 × 할인율
        calls.length = 0;
        await createActivationPayment({ pool, studentId: 1, academyId: 1, status: 'active', oldStatus: 'pending',
            monthlyTuition: 125000, discountRate: 32.8, enrollmentDate: '2026-12-01', classDays: [1, 3, 5], currentTimeSlot: 'evening' });
        const insert = calls.find(([sql]) => /INSERT INTO student_payments/.test(sql))[1]; // 학생, 학원, 월, 연, 월, 일할, 할인, 최종
        expect(insert.slice(5, 8)).toEqual([125000, 41000, 84000]);
        calls.length = 0;
        await createActivationPayment({ pool, studentId: 1, academyId: 1, status: 'active', oldStatus: 'pending',
            monthlyTuition: combo.amount, discountRate: 0, enrollmentDate: `2026-12-${String(combo.day).padStart(2, '0')}`,
            classDays: combo.weekdays, currentTimeSlot: 'evening' });
        expect(calls.find(([sql]) => /INSERT INTO student_payments/.test(sql))[1][5]).toBe(exRatio(combo.amount, combo.n, combo.d));
    });

    test('휴원 복귀 일할(resumePaymentService): 할인 = 금액 × 할인율', () => {
        const rate = findRate(r => t(125000 * r / 100), r => exPct(125000, r));
        expect(rate).toBe(32.8);
        const plan = calculateResumePayment({ monthly_tuition: 125000, discount_rate: rate }, '2026-12-01', [1, 3, 5]);
        expect([plan.baseAmount, plan.discountAmount, plan.finalAmount]).toEqual([125000, 41000, 84000]);
        // 1일이 아닌 복귀: 학원비 × 남은 수업일 / (주 횟수 × 4)
        const later = calculateResumePayment({ monthly_tuition: 333333.33, discount_rate: 12.5 }, '2026-12-16', [1, 3, 5]);
        expect(later.baseAmount).toBe(exRatio(333333.33, later.remainingClassDays, later.totalClassDays));
        expect(later.discountAmount).toBe(exPct(later.baseAmount, 12.5));
    });

    test('시즌 연속 할인(planSeasonEnrollment): 시즌비 × 할인율', () => {
        const fee = findAmount(x => t(x * (58 / 100)), x => exPct(x, 58));
        expect(fee).toBe(50000);
        const plan = planSeasonEnrollment({
            season: { id: 2, season_start_date: '2026-12-01', season_end_date: '2027-02-26', continuous_discount_type: 'rate',
                continuous_discount_rate: 58, default_season_fee: fee },
            student: { id: 1 }, seasonFee: fee, registrationDate: '2026-11-20', isContinuous: true, previousSeasonId: 1,
        });
        expect(plan.discountAmount).toBe(29000);
    });

    test('시즌 중간 합류 일할·비시즌 종강 일할·시즌 환불(seasonCalculator)', () => {
        const at = day => new Date(`2026-12-${String(day).padStart(2, '0')}T00:00:00`);
        const seasonOf = weeklyDays => ({ seasonStartDate: at(1), seasonEndDate: at(31), weeklyDays });
        // 중간 합류: 시즌비 × (남은 / 전체 수업일)
        const midCombos = WEEKDAY_SETS.flatMap(weeklyDays => Array.from({ length: 27 }, (_, i) => i + 2).map(day => {
            const probe = calculateMidSeasonFee({ ...seasonOf(weeklyDays), seasonFee: 300000, joinDate: at(day) });
            return { weeklyDays, day, n: probe.remainingDays, d: probe.totalDays };
        })).filter(c => c.d > 0);
        const mid = findCombo(midCombos, (b, n, d) => t(b * (n / d)), (b, n, d) => exRatio(b, n, d));
        expect(mid).not.toBeNull();
        expect(calculateMidSeasonFee({ ...seasonOf(mid.weeklyDays), seasonFee: mid.amount, joinDate: at(mid.day) }).proRatedFee)
            .toBe(exRatio(mid.amount, mid.n, mid.d));

        // 비시즌 종강 일할: 월 수강료 ÷ (주 횟수 × 4) × 종강까지 수업 수(원 단위), 할인(원 단위)
        const endCombos = WEEKDAY_SETS.flatMap(weeklyDays => Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
            const probe = calculateProRatedFee({ monthlyFee: 300000, weeklyDays, nonSeasonEndDate: at(day), discountRate: 0 });
            return { weeklyDays, day, n: probe.classCountUntilEnd, d: probe.totalMonthlyClasses };
        }));
        const end = findCombo(endCombos, (b, n, d) => t(b / d * n, 1), (b, n, d) => exRatio(b, n, d, 1));
        expect(end).not.toBeNull();
        const base = exRatio(end.amount, end.n, end.d, 1);
        const rate = findRate(r => t(base * (r / 100), 1), r => exPct(base, r, 1));
        const p = calculateProRatedFee({ monthlyFee: end.amount, weeklyDays: end.weeklyDays, nonSeasonEndDate: at(end.day), discountRate: rate });
        expect([p.baseAmount, p.discountAmount]).toEqual([base, exPct(base, rate, 1)]);

        // 환불 이용료: 납부액 × 이용 수업일 / 전체 수업일, 부가세 = 환불금 / 11
        const refundCombos = WEEKDAY_SETS.flatMap(weeklyDays => Array.from({ length: 29 }, (_, i) => i + 2).map(day => {
            const probe = calculateSeasonRefund({ paidAmount: 300000, ...seasonOf(weeklyDays), cancellationDate: `2026-12-${String(day).padStart(2, '0')}` });
            return { weeklyDays, day, n: probe.attendedDays, d: probe.totalClassDays };
        })).filter(c => c.d > 0);
        const refund = findCombo(refundCombos, (b, n, d) => t(b * (n / d)), (b, n, d) => exRatio(b, n, d));
        expect(refund).not.toBeNull();
        const r = calculateSeasonRefund({ paidAmount: refund.amount, ...seasonOf(refund.weeklyDays),
            cancellationDate: `2026-12-${String(refund.day).padStart(2, '0')}`, includeVat: true });
        expect(r.usedAmount).toBe(exRatio(refund.amount, refund.n, refund.d));
        expect(r.vatAmount).toBe(exRatio(refund.amount - r.usedAmount, 1, 11));
    });
});
