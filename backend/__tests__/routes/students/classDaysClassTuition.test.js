/**
 * 수업일 변경의 학원비 자동 계산: 학생 반의 학원비 표 → 없으면 학원 표.
 * 반 표가 없으면(class_tuition NULL) 지금까지와 같은 금액·같은 쿼리 순서다.
 */
jest.mock('../../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));
jest.mock('../../../utils/encryption', () => ({ decrypt: jest.fn((v) => v) }));
jest.mock('../../../utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');
const { applyScheduledClassDaysChanges } = require('../../../scheduler/classDaysScheduler');
const { resolveTuitionTable, weeklyTuitionAmount } = require('../../../utils/tuitionSettings');

const academySettings = { exam_tuition: { weekly_2: 300000 }, adult_tuition: { weekly_2: 200000 } };
const classTable = JSON.stringify({ weekly_1: 0, weekly_2: 450000, weekly_3: 0, weekly_4: 0, weekly_5: 0, weekly_6: 0, weekly_7: 0 });

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/students/classDays')(router);
    app.use('/paca/students', router);
    return app;
}
const tuitionWritten = () => {
    const call = db.query.mock.calls.find(([sql]) => /UPDATE students/.test(sql) && /SET class_days = \?/.test(sql));
    return /monthly_tuition = \?/.test(call[0]) ? call[1][2] : null;
};
const billUpdate = () => db.query.mock.calls.find(([sql]) => /UPDATE student_payments/.test(sql));

beforeEach(() => db.query.mockReset());

describe('학원비 표 찾기', () => {
    test('반 표가 없으면 학원 표를 저장된 모양 그대로 쓴다(입시/성인 구분)', () => {
        expect(resolveTuitionTable(academySettings, 'exam', null)).toBe(academySettings.exam_tuition);
        expect(resolveTuitionTable(academySettings, 'adult', undefined)).toBe(academySettings.adult_tuition);
        expect(resolveTuitionTable(null, 'exam', null)).toBeNull();
        expect(weeklyTuitionAmount(resolveTuitionTable(academySettings, 'exam', null), 2)).toBe(300000);
        expect(weeklyTuitionAmount(resolveTuitionTable(academySettings, 'exam', null), 3)).toBeNull();
    });

    test('반 표가 있으면 입시/성인과 상관없이 반 표, 0원 칸은 바꾸지 않는다(null)', () => {
        expect(weeklyTuitionAmount(resolveTuitionTable(academySettings, 'exam', classTable), 2)).toBe(450000);
        expect(weeklyTuitionAmount(resolveTuitionTable(academySettings, 'adult', JSON.parse(classTable)), 2)).toBe(450000);
        expect(weeklyTuitionAmount(resolveTuitionTable(academySettings, 'exam', classTable), 3)).toBeNull();
        expect(weeklyTuitionAmount(resolveTuitionTable(null, 'exam', classTable), 2)).toBe(450000);
        expect(weeklyTuitionAmount(resolveTuitionTable(academySettings, 'exam', classTable), 0)).toBeNull();
    });

    test('반 표가 모두 0원이면 표 없음 — 학원 표를 쓴다', () => {
        const allZero = JSON.stringify({ weekly_1: 0, weekly_2: 0, weekly_3: 0 });
        expect(resolveTuitionTable(academySettings, 'exam', allZero)).toBe(academySettings.exam_tuition);
        expect(weeklyTuitionAmount(resolveTuitionTable(academySettings, 'exam', allZero), 2)).toBe(300000);
    });
});

describe('수업일 즉시 변경', () => {
    test.each([
        ['반 표 없음 → 학원 표 금액(기존과 같음)', null, 300000],
        ['반 표 있음 → 반 금액', classTable, 450000],
    ])('개별 변경: %s', async (_label, classTuition, expected) => {
        db.query
            .mockResolvedValueOnce([[{ id: 56, class_days: '[3]', time_slot: 'evening', student_type: 'exam', class_tuition: classTuition }]])
            .mockResolvedValueOnce([[{ settings: academySettings }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ discount_rate: 10 }]])
            .mockResolvedValue([{ affectedRows: 0 }]);

        const res = await request(makeApp()).put('/paca/students/56/class-days').send({ class_days: [3, 6] });

        expect(res.status).toBe(200);
        expect(db.query.mock.calls[0][0]).toMatch(/LEFT JOIN classes c ON c.id = s.class_id AND c.academy_id = s.academy_id/);
        expect(tuitionWritten()).toBe(expected);
        // 미납 월 청구 갱신(기존 동작)도 같은 금액으로 — 할인액은 월 자동 청구처럼 천원 절삭
        expect(billUpdate()[1].slice(0, 4)).toEqual([expected, expected / 10, expected, expected / 10]);
    });

    test.each([
        ['반 표 없음 → 학원 표 금액(기존과 같음)', null, 300000],
        ['반 표 있음 → 반 금액', classTable, 450000],
    ])('일괄 변경: %s', async (_label, classTuition, expected) => {
        db.query
            .mockResolvedValueOnce([[{ settings: academySettings }]])
            .mockResolvedValueOnce([[{ class_days: '[3]', time_slot: 'evening', student_type: 'exam', class_tuition: classTuition }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ discount_rate: 0 }]])
            .mockResolvedValue([{ affectedRows: 0 }]);

        const res = await request(makeApp()).put('/paca/students/class-days/bulk').send({ students: [{ id: 56, class_days: [3, 6] }] });

        expect(res.status).toBe(200);
        expect(res.body.results[0].newTuition).toBe(expected);
        expect(tuitionWritten()).toBe(expected);
    });

    test.each([
        ['개별', () => request(makeApp()).put('/paca/students/56/class-days').send({ class_days: [1, 4] }), true],
        ['일괄', () => request(makeApp()).put('/paca/students/class-days/bulk').send({ students: [{ id: 56, class_days: [1, 4] }] }), false],
    ])('%s 변경: 요일만 바뀌고 새 금액이 지금과 같으면 미납 청구(손으로 고친 것)를 건드리지 않는다', async (_label, send, single) => {
        const row = { id: 56, class_days: '[3,6]', time_slot: 'evening', student_type: 'exam', monthly_tuition: '300000.00', class_tuition: null };
        const settings = [[{ settings: academySettings }]];
        if (single) db.query.mockResolvedValueOnce([[row]]).mockResolvedValueOnce(settings);
        else db.query.mockResolvedValueOnce(settings).mockResolvedValueOnce([[row]]);
        db.query.mockResolvedValue([{ affectedRows: 1 }]);

        expect((await send()).status).toBe(200);
        expect(tuitionWritten()).toBe(300000);
        expect(billUpdate()).toBeUndefined();
    });

    test('반 표에 그 횟수 금액이 없으면 학원비를 바꾸지 않는다', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 56, class_days: '[3]', time_slot: 'evening', student_type: 'exam', class_tuition: classTable }]])
            .mockResolvedValueOnce([[{ settings: academySettings }]])
            .mockResolvedValue([{ affectedRows: 1 }]);

        const res = await request(makeApp()).put('/paca/students/56/class-days').send({ class_days: [1, 3, 5] });

        expect(res.status).toBe(200);
        expect(tuitionWritten()).toBeNull();
        expect(billUpdate()).toBeUndefined();
    });
});

describe('수업일 변경 예약 스케줄러', () => {
    test.each([
        ['반 표 없음 → 학원 표 금액(기존과 같음)', null, 300000],
        ['반 표 있음 → 반 금액', classTable, 450000],
    ])('%s', async (_label, classTuition, expected) => {
        db.query
            .mockResolvedValueOnce([[{ id: 7, name: 'x', class_days: '[1]', class_days_next: '[1,4]', student_type: 'exam', time_slot: 'evening', class_tuition: classTuition }]])
            .mockResolvedValueOnce([[{ settings: JSON.stringify(academySettings) }]])
            .mockResolvedValue([{ affectedRows: 1 }]);

        const result = await applyScheduledClassDaysChanges();

        expect(db.query.mock.calls[0][0]).toMatch(/LEFT JOIN classes c ON c.id = s.class_id AND c.academy_id = s.academy_id/);
        expect(result.students[0].newTuition).toBe(expected);
        expect(db.query.mock.calls[2][1][2]).toBe(expected);
    });
});
