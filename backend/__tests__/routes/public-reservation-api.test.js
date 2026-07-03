jest.mock('../../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../../utils/encryption', () => ({
    decrypt: jest.fn((value) => value),
}));

jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock('web-push', () => ({
    sendNotification: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/public', require('../../routes/public/reservation'));
    return app;
}

function reservationRow(overrides = {}) {
    return {
        id: 10,
        academy_id: 3,
        academy_name: '테스트학원',
        slug: 'academy-a',
        student_name: '홍길동',
        student_grade: '고1',
        parent_phone: '010-1234-5678',
        preferred_date: '2026-07-10',
        preferred_time: '14:00:00',
        reservation_number: 'C20260702001',
        status: 'confirmed',
        ...overrides,
    };
}

describe('public reservation API guards', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    test('연락처 끝 4자리 없이는 DB 조회 전에 거부한다', async () => {
        const res = await request(makeApp()).get('/paca/public/reservation/C20260702001');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('예약자 연락처 끝 4자리를 입력해주세요.');
        expect(db.query).not.toHaveBeenCalled();
    });

    test('틀린 연락처는 예약 존재 여부를 노출하지 않는 404로 응답한다', async () => {
        db.query.mockResolvedValueOnce([[reservationRow()]]);

        const res = await request(makeApp())
            .get('/paca/public/reservation/C20260702001?phoneLast4=9999');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('예약번호 또는 연락처를 확인해주세요.');
    });

    test('학원 slug 경로는 slug와 예약번호를 함께 확인한다', async () => {
        db.query.mockResolvedValueOnce([[reservationRow()]]);

        const res = await request(makeApp())
            .get('/paca/public/consultation/academy-a/reservation/C20260702001?phoneLast4=5678');

        expect(res.status).toBe(200);
        expect(res.body.academySlug).toBe('academy-a');
        expect(db.query.mock.calls[0][0]).toContain('a.slug = ?');
        expect(db.query.mock.calls[0][1]).toEqual(['C20260702001', 'academy-a']);
    });

    test('예약 수정은 학원 id까지 조건에 넣어 업데이트한다', async () => {
        db.query
            .mockResolvedValueOnce([[reservationRow()]])
            .mockResolvedValueOnce([[{ count: 0 }]])
            .mockResolvedValueOnce([[{ max_reservations_per_slot: 1 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[]]);

        const res = await request(makeApp())
            .put('/paca/public/consultation/academy-a/reservation/C20260702001')
            .send({
                phoneLast4: '5678',
                preferredDate: '2026-07-11',
                preferredTime: '15:00',
            });

        expect(res.status).toBe(200);
        expect(db.query.mock.calls[3][0]).toContain('WHERE id = ? AND academy_id = ?');
        expect(db.query.mock.calls[3][1]).toEqual(['2026-07-11', '15:00:00', 10, 3]);
    });
});
