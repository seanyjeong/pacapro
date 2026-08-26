jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../config/database', () => ({ query: jest.fn() }));

const db = require('../../config/database');
const { promoteStudentGrades } = require('../../scheduler/gradePromotionScheduler');

describe('gradePromotionScheduler', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    test('정기 승급도 고2 선행반을 고3 정시로 원자적으로 전환한다', async () => {
        db.query
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 2 }]])
            .mockResolvedValueOnce([{ affectedRows: 2 }])
            .mockResolvedValueOnce([{ affectedRows: 2 }])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]]);

        const result = await promoteStudentGrades(false);

        const studentUpdate = db.query.mock.calls.find(([sql]) => /UPDATE students\s+SET/.test(sql));
        expect(studentUpdate).toBeDefined();
        expect(studentUpdate[0]).toMatch(/admission_type\s*=\s*CASE/);
        expect(studentUpdate[0]).toMatch(/admission_type\s*=\s*'advance'/);
        expect(studentUpdate[1]).toEqual(['고3', '고2']);
        expect(result).toEqual({
            promoted: 2,
            details: [{ from: '고2', to: '고3', count: 2 }],
        });
    });

    test('dry-run은 승급 대상을 세지만 학생과 상담을 변경하지 않는다', async () => {
        db.query
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 1 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]]);

        const result = await promoteStudentGrades(true);

        expect(result.promoted).toBe(1);
        expect(db.query.mock.calls.some(([sql]) => /UPDATE students\s+SET/.test(sql))).toBe(false);
        expect(db.query.mock.calls.some(([sql]) => /UPDATE consultations/.test(sql))).toBe(false);
    });

    test('고3에 남아 있던 선행반도 N수 승급 때 정시로 정리한다', async () => {
        db.query
            .mockResolvedValueOnce([[{ cnt: 1 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]])
            .mockResolvedValueOnce([[{ cnt: 0 }]]);

        await promoteStudentGrades(false);

        const studentUpdate = db.query.mock.calls.find(([sql]) => /UPDATE students\s+SET/.test(sql));
        expect(studentUpdate[0]).toMatch(/admission_type\s*=\s*CASE/);
        expect(studentUpdate[1]).toEqual(['N수', '고3']);
    });
});
