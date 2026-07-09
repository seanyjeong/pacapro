/**
 * routes/consultations/conversion.js 테스트 (Phase 3 #2)
 *
 * 회귀 보호 범위:
 *   - 2 endpoint 응답 표면 (ADR-013):
 *     POST /:id/convert-to-trial   → { message, studentId, trialDates }
 *     POST /:id/convert-to-pending → { message, studentId }
 *   - 입력 검증 (400) + 상담 미존재 (404) + 이미 학생 등록 (400) + 5xx 한국어
 *   - DB 호출 패턴 (ADR-005): pool.execute 만
 *   - encrypt 시그니처 보존 (ADR-007) + ENC: prefix 가드 보존
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

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { encrypt } = require('../../../utils/encryption');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/consultations/conversion')(router);
    app.use('/paca/consultations', router);
    return app;
}

function resetMocks() {
    pool.execute.mockReset();
    pool.query.mockReset();
    encrypt.mockClear();
}

describe('POST /paca/consultations/:id/convert-to-trial', () => {
    beforeEach(() => resetMocks());

    test('trialDates 누락/빈 배열 → 400', async () => {
        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-trial')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('최소 1개의 체험 일정을 선택해주세요.');
    });

    test('상담 미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT consultation
        const res = await request(makeApp())
            .post('/paca/consultations/999/convert-to-trial')
            .send({ trialDates: [{ date: '2026-05-10', timeSlot: '오전' }] });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('상담 신청을 찾을 수 없습니다.');
    });

    test('이미 일반 학생 연결됨 → 400', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
            id: 5, linked_student_id: 100, student_name: 'enc:홍길동', preferred_date: '2026-05-10',
            }]])
            .mockResolvedValueOnce([[{ id: 100, status: 'active', is_trial: 0, trial_dates: null }]]);
        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-trial')
            .send({ trialDates: [{ date: '2026-05-10', timeSlot: '오전' }] });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('이미 학생으로 등록되어 있습니다.');
    });

    test('이미 체험 학생 연결됨 → 재시도 성공 응답', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, linked_student_id: 101, student_name: 'enc:홍길동', preferred_date: '2026-05-10',
            }]])
            .mockResolvedValueOnce([[{
                id: 101,
                is_trial: 1,
                trial_dates: '[{"date":"2026-05-10","time_slot":"morning","attended":false}]',
            }]]);
        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-trial')
            .send({ trialDates: [{ date: '2026-05-10', timeSlot: '오전' }] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: '이미 체험 학생으로 등록되어 있습니다.',
            studentId: 101,
            trialDates: [{ date: '2026-05-10', time_slot: 'morning', attended: false }],
        });
    });

    test('자동 생성된 pending 학생 연결됨 → 기존 학생을 체험생으로 전환', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5,
                linked_student_id: 100,
                student_name: 'enc:홍길동',
                preferred_date: '2026-05-10',
            }]])
            .mockResolvedValueOnce([[{ id: 100, status: 'pending', is_trial: 0, trial_dates: null }]])
            .mockResolvedValueOnce([{}]) // UPDATE existing pending student
            .mockResolvedValueOnce([[]]) // SELECT class_schedules
            .mockResolvedValueOnce([{ insertId: 300 }]) // INSERT class_schedules
            .mockResolvedValueOnce([{}]) // INSERT attendance
            .mockResolvedValueOnce([{}]); // UPDATE consultations

        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-trial')
            .send({ trialDates: [{ date: '2026-05-10', timeSlot: '오전' }] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: '체험 학생으로 등록되었습니다.',
            studentId: 100,
            trialDates: [{ date: '2026-05-10', time_slot: 'morning', attended: false }],
        });
        expect(pool.execute.mock.calls[2][0]).toContain('UPDATE students');
        expect(pool.execute.mock.calls[2][1]).toEqual([
            1,
            1,
            JSON.stringify([{ date: '2026-05-10', time_slot: 'morning', attended: false }]),
            100,
            1,
        ]);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('정상 → 201 학생 + 스케줄 자동 배정 + UPDATE consultation, 응답 { message, studentId, trialDates }', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, linked_student_id: null,
                student_name: 'enc:홍길동',
                student_grade: 'middle3', student_school: '학교A',
                gender: 'male',
                parent_phone: 'enc:01011112222',
                preferred_date: '2026-05-01',
            }]]) // SELECT consultation
            .mockResolvedValueOnce([{ insertId: 200 }]) // INSERT students
            .mockResolvedValueOnce([[]]) // SELECT class_schedules (없음)
            .mockResolvedValueOnce([{ insertId: 300 }]) // INSERT class_schedules
            .mockResolvedValueOnce([{}]) // INSERT attendance
            .mockResolvedValueOnce([{}]); // UPDATE consultations

        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-trial')
            .send({ trialDates: [{ date: '2026-05-10', timeSlot: '오전' }] });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('체험 학생으로 등록되었습니다.');
        expect(res.body.studentId).toBe(200);
        expect(res.body.trialDates).toEqual([
            { date: '2026-05-10', time_slot: 'morning', attended: false },
        ]);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('이미 암호화된 student_name (ENC: prefix) → 재암호화 X', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, linked_student_id: null,
                student_name: 'ENC:abc123', // 이미 암호화
                student_grade: 'middle3', student_school: null,
                gender: null, parent_phone: null,
                preferred_date: '2026-05-01',
            }]])
            .mockResolvedValueOnce([{ insertId: 201 }])
            .mockResolvedValueOnce([[{ id: 999 }]]) // SELECT class_schedules (있음)
            .mockResolvedValueOnce([{}]) // INSERT attendance
            .mockResolvedValueOnce([{}]); // UPDATE consultations

        await request(makeApp())
            .post('/paca/consultations/5/convert-to-trial')
            .send({ trialDates: [{ date: '2026-05-10', timeSlot: '오후' }] });

        // student_name 은 이미 ENC: prefix 였으니 encrypt() 가 그것에 대해 호출되지 X
        const calledWithEncryptedName = encrypt.mock.calls.some((c) => c[0] === 'ENC:abc123');
        expect(calledWithEncryptedName).toBe(false);
    });

    test('5xx → { error: 한국어 } + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB internal'));
        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-trial')
            .send({ trialDates: [{ date: '2026-05-10', timeSlot: '오전' }] });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('서버 오류가 발생했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB internal');
    });
});

describe('POST /paca/consultations/:id/convert-to-pending', () => {
    beforeEach(() => resetMocks());

    test('상담 미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/consultations/999/convert-to-pending')
            .send({});
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('상담 신청을 찾을 수 없습니다.');
    });

    test('이미 학생 연결됨 → 400', async () => {
        pool.execute.mockResolvedValueOnce([[{
            id: 5, linked_student_id: 100,
            student_name: 'enc:홍길동', preferred_date: '2026-05-01',
        }]]);
        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-pending')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('이미 학생으로 등록되어 있습니다.');
    });

    test('정상 → { message, studentId } (단순 INSERT students + UPDATE consultations)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                id: 5, linked_student_id: null,
                student_name: 'enc:홍길동',
                student_grade: 'middle3', student_school: '학교A',
                gender: 'female',
                parent_phone: 'enc:010', inquiry_content: '문의내용',
                preferred_date: '2026-05-01',
            }]])
            .mockResolvedValueOnce([{ insertId: 250 }])
            .mockResolvedValueOnce([{}]); // UPDATE consultations

        const res = await request(makeApp())
            .post('/paca/consultations/5/convert-to-pending')
            .send({ memo: '메모입력' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('미등록관리 학생으로 등록되었습니다.');
        expect(res.body.studentId).toBe(250);
        expect(pool.query).not.toHaveBeenCalled();
    });
});
