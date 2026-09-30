jest.mock('../../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../../middleware/auth', () => ({
    verifyToken: (req, res, next) => { req.user = { academyId: 7, id: 101 }; next(); },
    checkPermission: () => (req, res, next) => next(),
}));
jest.mock('../../../utils/naverSens', () => ({
    decryptApiKey: jest.fn(() => 'test-secret'),
    sendSMS: jest.fn(async () => ({ success: true, requestId: 'test-request' })),
    sendMMS: jest.fn(),
    isValidPhoneNumber: (phone) => /^010-?\d{4}-?\d{4}$/.test(phone || ''),
}));
jest.mock('../../../utils/solapi', () => ({ sendSMSSolapi: jest.fn(), sendMMSSolapi: jest.fn() }));
jest.mock('../../../utils/encryption', () => ({ decryptArrayFields: jest.fn((rows) => rows) }));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');
const { sendSMS } = require('../../../utils/naverSens');
const { decryptArrayFields } = require('../../../utils/encryption');
const { countSmsRecipients } = require('../../../services/smsRecipientService');
const smsRouter = require('../../../routes/sms');

const students = [
    { id: 1, name: '학생1', student_phone: '010-1111-1111', parent_phone: '010-9000-0000', father_phone: '010-2222-2222', mother_phone: '010-3333-3333' },
    { id: 2, name: '학생2', student_phone: '010-1111-1111', parent_phone: null, father_phone: '010-2222-2222', mother_phone: '잘못된 번호' },
    { id: 3, name: '학생3', student_phone: null, parent_phone: '010-4444-4444', father_phone: null, mother_phone: '010-5555-5555' },
];

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/sms', smsRouter);
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation(async (query) => {
        if (query.includes('FROM notification_settings')) return [[{ sms_service_id: 'test-service', naver_secret_key: 'encrypted' }]];
        if (query.includes('FROM sender_numbers')) return [[{ phone: '010-7777-7777' }]];
        if (query.includes('FROM students')) return [students];
        if (query.includes('INTO notification_logs')) return [{ affectedRows: 1 }];
        throw new Error(`Unexpected SQL: ${query}`);
    });
});

test('counts distinct father and mother numbers without guessing from legacy parent_phone', async () => {
    expect(countSmsRecipients(students)).toEqual({ all: 3, students: 1, parents: 2, fathers: 1, mothers: 2 });
    const response = await request(buildApp()).get('/paca/sms/recipients-count?statusFilter=active');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ all: 3, students: 1, parents: 2, fathers: 1, mothers: 2 });
    expect(db.query.mock.calls[0][0]).toContain('s.father_phone, s.mother_phone');
    expect(db.query.mock.calls[0][1]).toEqual([7, 'active']);
    expect(decryptArrayFields).toHaveBeenCalledWith(students,
        ['student_phone', 'parent_phone', 'father_phone', 'mother_phone']);
});

test.each([
    ['fathers', '010-2222-2222'],
    ['mothers', '010-3333-3333', '010-5555-5555'],
    ['parents', '010-9000-0000', '010-4444-4444'],
])('send target %s reaches only selected contact role', async (target, ...phones) => {
    const response = await request(buildApp()).post('/paca/sms/send').send({
        target, content: '합성 안내', statusFilter: 'active', senderNumberId: 4,
    });
    expect(response.status).toBe(200);
    expect(response.body.sent).toBe(phones.length);
    expect(sendSMS).toHaveBeenCalledTimes(1);
    expect(sendSMS.mock.calls[0][2].map((recipient) => recipient.phone)).toEqual(phones);
    expect(db.query.mock.calls.find(([query]) => query.includes('FROM students'))[1]).toEqual([7, 'active']);
    expect(decryptArrayFields).toHaveBeenCalledWith(students,
        ['student_phone', 'parent_phone', 'father_phone', 'mother_phone', 'name']);
});

test('legacy-only parent number is never treated as father or mother', async () => {
    db.query.mockImplementation(async (query) => {
        if (query.includes('FROM notification_settings')) return [[{ sms_service_id: 'test-service', naver_secret_key: 'encrypted' }]];
        if (query.includes('FROM sender_numbers')) return [[{ phone: '010-7777-7777' }]];
        if (query.includes('FROM students')) return [[{ id: 4, name: '학생4', parent_phone: '010-8888-8888' }]];
        throw new Error(`Unexpected SQL: ${query}`);
    });
    const response = await request(buildApp()).post('/paca/sms/send').send({ target: 'fathers', content: '합성 안내' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ sent: 0, failed: 0 });
    expect(sendSMS).not.toHaveBeenCalled();
});
