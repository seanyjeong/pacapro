jest.mock('../../config/database', () => ({ getConnection: jest.fn() }));

const db = require('../../config/database');
const { graduateDueStudents } = require('../../repositories/seasonGraduationRepository');

function connectionWithRows(rows, studentCount = 1, enrollmentCount = 1) {
    const connection = {
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest.fn()
            .mockResolvedValueOnce([rows])
            .mockResolvedValueOnce([{ affectedRows: studentCount }])
            .mockResolvedValueOnce([{ affectedRows: enrollmentCount }]),
    };
    db.getConnection.mockResolvedValueOnce(connection);
    return connection;
}

beforeEach(() => db.getConnection.mockReset());

test('학생과 시즌 적용 기록을 한 트랜잭션에 커밋한다', async () => {
    const connection = connectionWithRows([{ enrollment_id: 10, student_id: 7 }]);
    await expect(graduateDueStudents('2026-12-01')).resolves.toBe(1);
    expect(connection.query.mock.calls[0][1]).toEqual(['2026-12-01', '2026-12-01']);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
});

test('예상한 시즌 적용 기록이 바뀌면 학생 졸업도 롤백한다', async () => {
    const connection = connectionWithRows([{ enrollment_id: 10, student_id: 7 }], 1, 0);
    await expect(graduateDueStudents('2026-12-01')).rejects.toThrow('기록 수');
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
});
