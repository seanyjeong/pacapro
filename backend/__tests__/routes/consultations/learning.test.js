/**
 * routes/consultations/learning.js 테스트 (Phase 3 #2)
 *
 * 회귀 보호 범위:
 *   - POST /learning 응답 표면 (ADR-013): { message, consultationId, studentConsultationId } (201)
 *   - 필수 필드 검증 (400) + 학생 미존재 (404) + 5xx 한국어 메시지
 *   - DB 호출 패턴 (ADR-005): pool.execute 만 (db.query / pool.query 잔존 0건)
 *   - encrypt/decrypt 시그니처 보존 (ADR-007)
 *   - pushService 외부 호출 mock 으로 격리 (실 발송 0건)
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

jest.mock('../../../utils/solapi', () => ({ sendAlimtalkSolapi: jest.fn() }));
jest.mock('../../../utils/naverSens', () => ({ decryptApiKey: jest.fn(), sendAlimtalk: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

// pushService mock — sendPushToAcademyAdmins 가 await 가능한 noop
jest.mock('../../../services/pushService', () => ({
    sendPushToAcademyAdmins: jest.fn().mockResolvedValue(undefined),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { encrypt } = require('../../../utils/encryption');
const pushService = require('../../../services/pushService');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/consultations/learning')(router);
    app.use('/paca/consultations', router);
    return app;
}

function resetMocks() {
    pool.execute.mockReset();
    pool.query.mockReset();
    encrypt.mockClear();
    pushService.sendPushToAcademyAdmins.mockClear();
}

describe('POST /paca/consultations/learning', () => {
    beforeEach(() => resetMocks());

    test('필수 필드 누락 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/consultations/learning')
            .send({ studentId: 1 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('학생, 날짜, 시간, 상담유형은 필수입니다.');
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test('학생 미존재 → 404 한국어', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // students 조회 빈 배열

        const res = await request(makeApp())
            .post('/paca/consultations/learning')
            .send({
                studentId: 999, preferredDate: '2026-05-10', preferredTime: '14:00',
                learningType: 'regular',
            });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('학생을 찾을 수 없습니다.');
    });

    test('정상 → 201 + { message, consultationId, studentConsultationId } + pushService 호출', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5, name: 'enc:홍길동', phone: 'enc:010', grade: 'middle3' }]]) // SELECT students
            .mockResolvedValueOnce([{ insertId: 100 }]) // INSERT consultations
            .mockResolvedValueOnce([{ insertId: 200 }]); // INSERT student_consultations

        const res = await request(makeApp())
            .post('/paca/consultations/learning')
            .send({
                studentId: 5, preferredDate: '2026-05-10', preferredTime: '14:00',
                learningType: 'regular', adminNotes: '메모',
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('재원생 상담 일정이 등록되었습니다.');
        expect(res.body.consultationId).toBe(100);
        expect(res.body.studentConsultationId).toBe(200);
        expect(pool.execute).toHaveBeenCalledTimes(3);
        expect(pool.query).not.toHaveBeenCalled();
        expect(encrypt).toHaveBeenCalled();
        expect(pushService.sendPushToAcademyAdmins).toHaveBeenCalledTimes(1);
    });

    test('mockExamScores 입력 시 student_performance INSERT 추가', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5, name: 'enc:홍길동', phone: 'enc:010', grade: 'middle3' }]])
            .mockResolvedValueOnce([{ insertId: 100 }])
            .mockResolvedValueOnce([{ insertId: 200 }])
            .mockResolvedValueOnce([{ insertId: 300 }]) // 3월 INSERT student_performance
            .mockResolvedValueOnce([{ insertId: 301 }]); // 6월 INSERT student_performance

        const res = await request(makeApp())
            .post('/paca/consultations/learning')
            .send({
                studentId: 5, preferredDate: '2026-05-10', preferredTime: '14:00',
                learningType: 'regular',
                mockExamScores: {
                    '3월': { 국어: '2', 수학: '1' },
                    '6월': { 국어: '3' },
                    '9월': { 국어: '', 수학: null }, // skip (hasData false)
                },
            });

        expect(res.status).toBe(201);
        expect(pool.execute).toHaveBeenCalledTimes(5);
    });

    test('pushService 실패해도 응답은 201 (실패 무시)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5, name: 'enc:홍길동', phone: 'enc:010', grade: 'middle3' }]])
            .mockResolvedValueOnce([{ insertId: 100 }])
            .mockResolvedValueOnce([{ insertId: 200 }]);
        pushService.sendPushToAcademyAdmins.mockRejectedValueOnce(new Error('push fail'));

        const res = await request(makeApp())
            .post('/paca/consultations/learning')
            .send({
                studentId: 5, preferredDate: '2026-05-10', preferredTime: '14:00',
                learningType: 'admission',
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('재원생 상담 일정이 등록되었습니다.');
    });

    test('5xx → { error: 한국어 } + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB internal'));
        const res = await request(makeApp())
            .post('/paca/consultations/learning')
            .send({
                studentId: 5, preferredDate: '2026-05-10', preferredTime: '14:00',
                learningType: 'regular',
            });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('서버 오류가 발생했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB internal');
    });
});
