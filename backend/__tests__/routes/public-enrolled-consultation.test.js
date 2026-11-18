jest.mock('../../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../../utils/encryption', () => ({
    decrypt: jest.fn((value) => (typeof value === 'string' && value.startsWith('ENC:') ? value.slice(4) : value)),
    encrypt: jest.fn((value) => `ENC:${value}`),
}));

jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../../services/pushService', () => ({
    sendPushToAcademyAdmins: jest.fn(() => Promise.resolve({ success: 0, failed: 0 })),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../config/database');
const pushService = require('../../services/pushService');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/public', require('../../routes/public/enrolledConsultation'));
    return app;
}

const academyRow = { id: 2, name: '일산 맥스체대입시', is_enabled: 1, max_reservations_per_slot: 1 };

function studentRow(overrides = {}) {
    return {
        id: 77,
        name: 'ENC:김민준',
        phone: 'ENC:010-1111-2222',
        parent_phone: 'ENC:010-3333-4444',
        father_phone: null,
        mother_phone: 'ENC:01055556666',
        grade: '고2',
        branch_id: null,
        ...overrides,
    };
}

const applyBody = {
    studentName: '김민준',
    phone: '010-3333-4444',
    learningType: 'regular',
    inquiryContent: '수시 원서 상담',
    preferredDate: '2026-11-20',
    preferredTime: '15:00',
};

describe('재원생 상담 신청 공개 API', () => {
    beforeEach(() => {
        db.query.mockReset();
        pushService.sendPushToAcademyAdmins.mockClear();
    });

    test('이름과 학부모 번호가 맞으면 재원생으로 확인한다', async () => {
        db.query
            .mockResolvedValueOnce([[academyRow]])
            .mockResolvedValueOnce([[studentRow()]]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/verify')
            .send({ studentName: '김 민준', phone: '01033334444' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ matched: true });
        expect(db.query.mock.calls[1][0]).toContain("status = 'active'");
        expect(db.query.mock.calls[1][1]).toEqual([2]);
    });

    test('번호가 틀리면 원장님께 문의하라고 답하고 학생 정보는 내보내지 않는다', async () => {
        db.query
            .mockResolvedValueOnce([[academyRow]])
            .mockResolvedValueOnce([[studentRow()]]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/verify')
            .send({ studentName: '김민준', phone: '010-9999-9999' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: '이름 또는 전화번호가 맞지 않습니다. 원장님께 문의하세요.' });
    });

    test('이름이 틀려도 같은 안내를 한다', async () => {
        db.query
            .mockResolvedValueOnce([[academyRow]])
            .mockResolvedValueOnce([[studentRow()]]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/verify')
            .send({ studentName: '김민수', phone: '010-1111-2222' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('이름 또는 전화번호가 맞지 않습니다. 원장님께 문의하세요.');
    });

    test('번호 자리수가 모자라면 DB 를 보기 전에 거부한다', async () => {
        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/apply')
            .send({ ...applyBody, phone: '010-123' });

        expect(res.status).toBe(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('신청하면 재원생 상담(대기)으로 같은 상담 표에 넣고 원장님께 알린다', async () => {
        db.query
            .mockResolvedValueOnce([[academyRow]])
            .mockResolvedValueOnce([[studentRow({ branch_id: 5 })]])
            .mockResolvedValueOnce([[{ count: 0 }]])
            .mockResolvedValueOnce([{ insertId: 901 }]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/apply')
            .send(applyBody);

        expect(res.status).toBe(201);
        expect(res.body.consultationId).toBe(901);

        // 시간 마감은 상담 종류와 상관없이 같은 시간의 모든 상담으로 센다
        expect(db.query.mock.calls[2][0]).not.toContain('consultation_type');
        expect(db.query.mock.calls[2][1]).toEqual([2, '2026-11-20', '15:00:00']);

        const [insertSql, insertParams] = db.query.mock.calls[3];
        expect(insertSql).toContain("'learning'");
        expect(insertSql).toContain("'pending'");
        expect(insertParams).toEqual([2, 'regular', 77, 'ENC:김민준', '고2', '수시 원서 상담', '2026-11-20', '15:00:00', 5]);
        expect(pushService.sendPushToAcademyAdmins).toHaveBeenCalledWith(2, expect.objectContaining({ title: '재원생 상담 신청' }));
    });

    test('정시시즌·수시시즌 상담 종류도 받는다', async () => {
        db.query
            .mockResolvedValueOnce([[academyRow]])
            .mockResolvedValueOnce([[studentRow()]])
            .mockResolvedValueOnce([[{ count: 0 }]])
            .mockResolvedValueOnce([{ insertId: 902 }]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/apply')
            .send({ ...applyBody, learningType: 'jungsi_season' });

        expect(res.status).toBe(201);
        expect(db.query.mock.calls[3][1][1]).toBe('jungsi_season');
        expect(pushService.sendPushToAcademyAdmins).toHaveBeenCalledWith(2, expect.objectContaining({ body: expect.stringContaining('정시시즌') }));
    });

    test('모르는 상담 종류는 거부한다', async () => {
        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/apply')
            .send({ ...applyBody, learningType: 'winter_season' });

        expect(res.status).toBe(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('이미 찬 시간이면 409 로 막는다', async () => {
        db.query
            .mockResolvedValueOnce([[academyRow]])
            .mockResolvedValueOnce([[studentRow()]])
            .mockResolvedValueOnce([[{ count: 1 }]]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/apply')
            .send(applyBody);

        expect(res.status).toBe(409);
        expect(db.query).toHaveBeenCalledTimes(3);
    });

    test('신청 때도 이름·번호를 다시 확인한다', async () => {
        db.query
            .mockResolvedValueOnce([[academyRow]])
            .mockResolvedValueOnce([[studentRow()]]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/apply')
            .send({ ...applyBody, phone: '010-0000-0000' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('이름 또는 전화번호가 맞지 않습니다. 원장님께 문의하세요.');
        expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('일산(imaxnew) 말고 다른 학원 주소는 DB 를 보지 않고 막는다', async () => {
        const res = await request(makeApp())
            .post('/paca/public/consultation/tete/enrolled/verify')
            .send({ studentName: '김민준', phone: '010-3333-4444' });

        expect(res.status).toBe(404);
        expect(db.query).not.toHaveBeenCalled();
    });

    test('상담을 끈 학원은 받지 않는다', async () => {
        db.query.mockResolvedValueOnce([[{ ...academyRow, is_enabled: 0 }]]);

        const res = await request(makeApp())
            .post('/paca/public/consultation/imaxnew/enrolled/apply')
            .send(applyBody);

        expect(res.status).toBe(403);
    });
});
