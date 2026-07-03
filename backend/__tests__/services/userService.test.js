jest.mock('../../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../../utils/encryption', () => ({
    decrypt: jest.fn((value) => value),
}));

const db = require('../../config/database');
const userService = require('../../services/userService');

describe('userService.changeApprovalStatus', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    test('approve keeps the user row and marks it approved', async () => {
        db.query
            .mockResolvedValueOnce([[{
                id: 7,
                email: 'owner@example.com',
                name: '김원장',
                approval_status: 'pending',
                academy_id: 2,
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const result = await userService.changeApprovalStatus(7, 1, 'approved');

        expect(result.status).toBe(200);
        expect(db.query.mock.calls[1][0]).toContain('UPDATE users SET approval_status = ?');
        expect(db.query.mock.calls[1][1]).toEqual(['approved', 7]);
    });

    test('reject deletes the pending signup row so the email can register again', async () => {
        db.query
            .mockResolvedValueOnce([[{
                id: 8,
                email: 'rejected@example.com',
                name: '거절',
                approval_status: 'pending',
                academy_id: 3,
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const result = await userService.changeApprovalStatus(8, 1, 'rejected');

        expect(result.status).toBe(200);
        expect(result.user.approval_status).toBe('rejected');
        expect(db.query.mock.calls[1][0]).toContain('DELETE FROM users');
        expect(db.query.mock.calls[1][1]).toEqual([8, 'pending']);
    });
});
