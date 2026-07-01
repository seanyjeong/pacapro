jest.mock('../../../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 7, id: 101, role: 'admin' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/naverSens', () => ({
    decryptApiKey: jest.fn(),
    sendSMS: jest.fn(),
    sendMMS: jest.fn(),
    isValidPhoneNumber: jest.fn((phone) => /^010-\d{4}-\d{4}$/.test(phone || '')),
}));

jest.mock('../../../utils/solapi', () => ({
    sendSMSSolapi: jest.fn(),
    sendMMSSolapi: jest.fn(),
}));

jest.mock('../../../utils/encryption', () => ({
    decryptArrayFields: jest.fn((rows) => rows),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');
const smsRouter = require('../../../routes/sms');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/sms', smsRouter);
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
});

describe('SMS sender numbers academy isolation', () => {
    test('PUT /sender-numbers/:id scopes ownership check and final update by academy_id', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 55, service_type: 'sens', academy_id: 7 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(buildApp())
            .put('/paca/sms/sender-numbers/55')
            .send({ label: '대표번호' });

        expect(res.status).toBe(200);
        expect(db.query.mock.calls[0]).toEqual([
            expect.stringContaining('WHERE id = ? AND academy_id = ?'),
            ['55', 7],
        ]);
        expect(db.query.mock.calls[1]).toEqual([
            expect.stringContaining('WHERE id = ? AND academy_id = ?'),
            ['대표번호', '55', 7],
        ]);
    });

    test('DELETE /sender-numbers/:id scopes ownership check and final delete by academy_id', async () => {
        db.query
            .mockResolvedValueOnce([[{ id: 55, service_type: 'sens', academy_id: 7, is_default: 0 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(buildApp())
            .delete('/paca/sms/sender-numbers/55')
            .send({});

        expect(res.status).toBe(200);
        expect(db.query.mock.calls[0]).toEqual([
            expect.stringContaining('WHERE id = ? AND academy_id = ?'),
            ['55', 7],
        ]);
        expect(db.query.mock.calls[1]).toEqual([
            'DELETE FROM sender_numbers WHERE id = ? AND academy_id = ?',
            ['55', 7],
        ]);
    });
});
