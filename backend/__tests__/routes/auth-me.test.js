jest.mock('../../config/database', () => ({ query: jest.fn() }));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('../../middleware/auth', () => ({
    generateToken: jest.fn(() => 'token'),
    verifyToken: jest.fn((req, _res, next) => {
        req.user = { id: 17, role: 'staff', academy_id: 3 };
        next();
    }),
}));
jest.mock('../../routes/auth/registerHandler', () => (_req, res) => res.status(501).json({ message: 'mocked' }));
jest.mock('../../utils/encryption', () => ({
    decrypt: jest.fn((value) => value),
    decryptFields: jest.fn((row) => ({ ...row, name: '김강사', phone: '010-0000-0000' })),
    ENCRYPTED_FIELDS: { users: ['name', 'phone'] },
}));
jest.mock('../../utils/emailSender', () => ({
    sendPasswordResetEmail: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/auth', require('../../routes/auth'));
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
});

test('auth me returns latest staff permissions for mobile access refresh', async () => {
    db.query.mockResolvedValueOnce([[
        {
            id: 17,
            email: 'teacher@example.com',
            name: 'encrypted-name',
            phone: 'encrypted-phone',
            role: 'staff',
            academy_id: 3,
            academy_name: 'PACA 일산',
            position: '강사',
            permissions: JSON.stringify({
                schedules: { view: true, edit: true },
                payments: { view: false, edit: false },
                consultations: { view: false, edit: false },
            }),
        },
    ]]);

    const res = await request(makeApp()).get('/paca/auth/me');

    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][0]).toContain('u.permissions');
    expect(res.body.user).toMatchObject({
        id: 17,
        email: 'teacher@example.com',
        name: '김강사',
        role: 'staff',
        academy_id: 3,
        academyId: 3,
        academy_name: 'PACA 일산',
        academy: { id: 3, name: 'PACA 일산' },
        position: '강사',
        permissions: {
            schedules: { view: true, edit: true },
            payments: { view: false, edit: false },
            consultations: { view: false, edit: false },
        },
    });
});
