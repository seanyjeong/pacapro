jest.mock('../../config/database', () => ({
    getConnection: jest.fn(),
}));

const db = require('../../config/database');
const { resetAcademyData } = require('../../repositories/databaseResetRepository');

const connection = {
    beginTransaction: jest.fn(),
    execute: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
};

beforeEach(() => {
    Object.values(connection).forEach((mock) => mock.mockReset());
    connection.execute.mockResolvedValue([{ affectedRows: 1 }]);
    db.getConnection.mockReset();
    db.getConnection.mockResolvedValue(connection);
});

describe('resetAcademyData', () => {
    test('모든 삭제문을 하나의 트랜잭션에서 아카데미 ID로 제한', async () => {
        const result = await resetAcademyData(7);

        expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(connection.execute).toHaveBeenCalled();
        expect(result.deletedRows).toBe(connection.execute.mock.calls.length);
        for (const [sql, params] of connection.execute.mock.calls) {
            expect(sql).not.toMatch(/TRUNCATE/i);
            expect(sql).toMatch(/academy_id\s*=\s*\?/i);
            expect(params).toEqual([7]);
        }
        expect(connection.commit).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });

    test('삭제문 하나라도 실패하면 전체 작업을 취소', async () => {
        connection.execute.mockRejectedValueOnce(new Error('delete failed'));

        await expect(resetAcademyData(7)).rejects.toThrow('delete failed');

        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.commit).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledTimes(1);
    });
});
