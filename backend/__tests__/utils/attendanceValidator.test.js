const { validateAttendance, validateBatchAttendance } = require('../../utils/attendanceValidator');

// DB mock
jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

const db = require('../../config/database');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('validateAttendance', () => {
    test('같은 academy_id면 valid', async () => {
        db.query
            .mockResolvedValueOnce([[{ academy_id: 1 }]]) // student
            .mockResolvedValueOnce([[{ academy_id: 1 }]]); // schedule

        const result = await validateAttendance(100, 200);
        expect(result.valid).toBe(true);
        expect(result.studentAcademyId).toBe(1);
        expect(result.scheduleAcademyId).toBe(1);
    });

    test('다른 academy_id면 invalid', async () => {
        db.query
            .mockResolvedValueOnce([[{ academy_id: 1 }]]) // student
            .mockResolvedValueOnce([[{ academy_id: 2 }]]); // schedule

        const result = await validateAttendance(100, 200);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Academy mismatch');
    });

    test('학생이 없으면 invalid', async () => {
        db.query.mockResolvedValueOnce([[]]); // student not found

        const result = await validateAttendance(999, 200);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Student not found');
    });

    test('스케줄이 없으면 invalid', async () => {
        db.query
            .mockResolvedValueOnce([[{ academy_id: 1 }]]) // student
            .mockResolvedValueOnce([[]]); // schedule not found

        const result = await validateAttendance(100, 999);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Schedule not found');
    });

    test('DB 에러 시 invalid 반환', async () => {
        db.query.mockRejectedValueOnce(new Error('DB connection failed'));

        const result = await validateAttendance(100, 200);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('DB connection failed');
    });

    test('외부 커넥션 전달 시 해당 커넥션 사용', async () => {
        const mockConn = {
            query: jest.fn()
                .mockResolvedValueOnce([[{ academy_id: 1 }]])
                .mockResolvedValueOnce([[{ academy_id: 1 }]])
        };

        const result = await validateAttendance(100, 200, mockConn);
        expect(result.valid).toBe(true);
        expect(mockConn.query).toHaveBeenCalledTimes(2);
        expect(db.query).not.toHaveBeenCalled();
    });
});

describe('validateBatchAttendance', () => {
    test('모든 학생이 같은 academy면 valid', async () => {
        db.query
            .mockResolvedValueOnce([[{ academy_id: 1 }]]) // schedule
            .mockResolvedValueOnce([[
                { id: 1, academy_id: 1 },
                { id: 2, academy_id: 1 },
                { id: 3, academy_id: 1 },
            ]]); // students

        const result = await validateBatchAttendance([1, 2, 3], 200);
        expect(result.valid).toBe(true);
    });

    test('일부 학생이 다른 academy면 invalid + 목록 반환', async () => {
        db.query
            .mockResolvedValueOnce([[{ academy_id: 1 }]]) // schedule
            .mockResolvedValueOnce([[
                { id: 1, academy_id: 1 },
                { id: 2, academy_id: 2 }, // mismatch
                { id: 3, academy_id: 1 },
            ]]);

        const result = await validateBatchAttendance([1, 2, 3], 200);
        expect(result.valid).toBe(false);
        expect(result.invalidStudents).toEqual([2]);
    });

    test('스케줄이 없으면 invalid', async () => {
        db.query.mockResolvedValueOnce([[]]);

        const result = await validateBatchAttendance([1, 2], 999);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Schedule not found');
    });

    test('DB 에러 시 invalid 반환', async () => {
        db.query.mockRejectedValueOnce(new Error('timeout'));

        const result = await validateBatchAttendance([1], 200);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('timeout');
    });
});
