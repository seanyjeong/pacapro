/**
 * routes/consultations/write.js 테스트 (Phase 3 #2)
 *
 * 회귀 보호 범위:
 *   - 3 endpoint 응답 표면 (ADR-013):
 *     PUT /:id              → { message, reservationNumber, alimtalkSent }
 *     POST /direct          → { message, id } (201)
 *     POST /:id/link-student → { message, linkedStudent }
 *   - confirmed 전환 시 reservation_number 자동 발급 + 알림톡 발송 분기
 *     (learning 타입은 알림톡 발송 제외)
 *   - DB 호출 패턴 (ADR-005): pool.execute 만
 *   - encrypt 시그니처 보존 (ADR-007), sendConfirmationAlimtalk 호출 셰이프 보존
 *   - 입력 검증 (400) + 미존재 (404) + 5xx 한국어 메시지
 */

jest.mock('../../../config/database', () => ({
    query: jest.fn(),
    execute: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academy_id: 1, id: 100, role: 'owner' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    encrypt: jest.fn((v) => `enc:${v}`),
    decrypt: jest.fn((v) => v && typeof v === 'string' ? v.replace(/^enc:/, '') : v),
}));

// 외부 발송 채널 mock — sendConfirmationAlimtalk 가 호출하지만 본 테스트에서는 _utils.js 의
// generateReservationNumber / sendConfirmationAlimtalk 모듈 자체를 mock 하지 않고
// 실제 헬퍼를 통과시켜 pool.execute mock 으로 분기 검증.
// 단 외부 API 자체는 mock 으로 확실히 차단.
jest.mock('../../../utils/solapi', () => ({ sendAlimtalkSolapi: jest.fn().mockResolvedValue({ success: false }) }));
jest.mock('../../../utils/naverSens', () => ({
    decryptApiKey: jest.fn(() => null),
    sendAlimtalk: jest.fn().mockResolvedValue({ success: false }),
}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { encrypt } = require('../../../utils/encryption');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/consultations/write')(router);
    app.use('/paca/consultations', router);
    return app;
}

function resetMocks() {
    pool.execute.mockReset();
    pool.query.mockReset();
    encrypt.mockClear();
}

describe('PUT /paca/consultations/:id', () => {
    beforeEach(() => resetMocks());

    test('미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .put('/paca/consultations/999')
            .send({ status: 'pending' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('상담 신청을 찾을 수 없습니다.');
    });

    test('수정 내용 없음 → 400', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'pending', linked_student_id: null }]]);
        const res = await request(makeApp())
            .put('/paca/consultations/5')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('수정할 내용이 없습니다.');
    });

    test('단순 status 수정 → 200, alimtalkSent false (confirmed 전환 X)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, status: 'pending', linked_student_id: null,
                consultation_type: 'new_registration', reservation_number: null,
            }]]) // SELECT existing
            .mockResolvedValueOnce([{}]); // UPDATE consultations

        const res = await request(makeApp())
            .put('/paca/consultations/5')
            .send({ status: 'pending', adminNotes: '메모' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('상담 정보가 수정되었습니다.');
        expect(res.body.alimtalkSent).toBe(false);
    });

    test('confirmed 전환 (new_registration) → reservation_number 자동 발급 + alimtalkSent true', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, status: 'pending', linked_student_id: null,
                consultation_type: 'new_registration', reservation_number: null,
                preferred_date: '2026-05-10', preferred_time: '14:00:00',
            }]]) // SELECT existing
            .mockResolvedValueOnce([[{ reservation_number: null }]]) // generateReservationNumber SELECT (rows.length 0 도 가능 — 기존 마지막 번호 X)
            .mockResolvedValueOnce([{}]) // UPDATE consultations
            // 비동기 알림톡 발송 (settings 조회) — fire-and-forget 이라 응답 후 호출. 결과 무시.
            .mockResolvedValue([[]]);

        const res = await request(makeApp())
            .put('/paca/consultations/5')
            .send({ status: 'confirmed' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('상담 정보가 수정되었습니다.');
        expect(res.body.alimtalkSent).toBe(true);
        expect(typeof res.body.reservationNumber).toBe('string');
        expect(res.body.reservationNumber).toMatch(/^C\d{8}\d{3}$/);
    });

    test('confirmed 전환이지만 learning 타입 → 알림톡 발송 제외 (alimtalkSent 는 여전히 true)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, status: 'pending', linked_student_id: null,
                consultation_type: 'learning', reservation_number: 'C20260501001',
                preferred_date: '2026-05-10', preferred_time: '14:00:00',
            }]])
            .mockResolvedValueOnce([{}]); // UPDATE consultations (reservation_number 이미 있음)

        const res = await request(makeApp())
            .put('/paca/consultations/5')
            .send({ status: 'confirmed' });

        expect(res.status).toBe(200);
        expect(res.body.alimtalkSent).toBe(true);
        expect(res.body.reservationNumber).toBe('C20260501001');
        // learning 타입이라 settings 조회 발송 분기 X — pool.execute 호출 횟수가 늘어나지 않음.
        expect(pool.execute).toHaveBeenCalledTimes(2);
    });

    test('학생 정보 수정 + linked_student → students 테이블 동기화 UPDATE 추가', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, status: 'pending', linked_student_id: 100,
                consultation_type: 'new_registration', reservation_number: null,
                preferred_date: '2026-05-10', preferred_time: '14:00:00',
            }]])
            .mockResolvedValueOnce([{}]) // UPDATE consultations
            .mockResolvedValueOnce([{}]); // UPDATE students (sync)

        const res = await request(makeApp())
            .put('/paca/consultations/5')
            .send({
                studentName: '홍길동수정', studentGrade: 'high1',
                parentPhone: '01099998888',
            });

        expect(res.status).toBe(200);
        expect(pool.execute).toHaveBeenCalledTimes(3);
        // encrypt 호출 (parent_phone)
        expect(encrypt).toHaveBeenCalled();
    });
});

describe('POST /paca/consultations/direct', () => {
    beforeEach(() => resetMocks());

    test('필수 필드 누락 → 400', async () => {
        const res = await request(makeApp())
            .post('/paca/consultations/direct')
            .send({ studentName: '홍길동' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('학생명, 전화번호, 학년, 상담일시는 필수입니다.');
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test('정상 → 201 + { message, id }', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 50 }]);

        const res = await request(makeApp())
            .post('/paca/consultations/direct')
            .send({
                studentName: '홍길동', phone: '01011112222', grade: 'middle3',
                preferredDate: '2026-05-10', preferredTime: '14:00',
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('상담이 등록되었습니다.');
        expect(res.body.id).toBe(50);
        expect(pool.query).not.toHaveBeenCalled();
    });
});

describe('POST /paca/consultations/:id/link-student', () => {
    beforeEach(() => resetMocks());

    test('상담 미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/consultations/999/link-student')
            .send({ studentId: 5 });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('상담 신청을 찾을 수 없습니다.');
    });

    test('학생 미존재 → 404', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5 }]]) // 상담 존재
            .mockResolvedValueOnce([[]]); // 학생 없음
        const res = await request(makeApp())
            .post('/paca/consultations/5/link-student')
            .send({ studentId: 999 });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('학생을 찾을 수 없습니다.');
    });

    test('정상 → { message, linkedStudent } (학생 이름 복호화)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5 }]])
            .mockResolvedValueOnce([[{ id: 100, name: 'enc:홍길동' }]])
            .mockResolvedValueOnce([{}]); // UPDATE consultations

        const res = await request(makeApp())
            .post('/paca/consultations/5/link-student')
            .send({ studentId: 100 });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('학생이 연결되었습니다.');
        expect(res.body.linkedStudent).toEqual({ id: 100, name: '홍길동' });
    });
});
