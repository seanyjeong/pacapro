/**
 * routes/consultations/calendar.js 테스트 (Phase 3 #2)
 *
 * 회귀 보호 범위:
 *   - 3 endpoint × 응답 표면 (ADR-013 보존):
 *     GET /calendar/events       → { events: { [date]: [...] } }
 *     GET /booked-times          → { date, bookedTimes: [...] }
 *     GET /by-student/:studentId → { consultation: {...} } (no message)
 *   - DB 호출 패턴 (ADR-005): pool.execute 만
 *   - decrypt 시그니처 보존 (ADR-007)
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

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/consultations/calendar')(router);
    app.use('/paca/consultations', router);
    return app;
}

function resetMocks() {
    pool.execute.mockReset();
    pool.query.mockReset();
}

describe('GET /paca/consultations/calendar/events', () => {
    beforeEach(() => resetMocks());

    test('startDate/endDate 누락 → 400', async () => {
        const res = await request(makeApp()).get('/paca/consultations/calendar/events');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('시작일과 종료일이 필요합니다.');
    });

    test('정상 → events root 키 + 날짜별 그룹화', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 10, student_name: 'enc:홍길동', preferred_date: '2026-05-10', preferred_time: '14:00:00' },
            { id: 11, student_name: 'enc:김철수', preferred_date: '2026-05-10', preferred_time: '15:00:00' },
            { id: 12, student_name: 'enc:이영희', preferred_date: '2026-05-11', preferred_time: '10:00:00' },
        ]]);

        const res = await request(makeApp())
            .get('/paca/consultations/calendar/events?startDate=2026-05-01&endDate=2026-05-31');

        expect(res.status).toBe(200);
        expect(res.body.events).toBeDefined();
        expect(res.body.events['2026-05-10']).toHaveLength(2);
        expect(res.body.events['2026-05-10'][0].student_name).toBe('홍길동');
        expect(res.body.events['2026-05-11']).toHaveLength(1);
        expect(pool.query).not.toHaveBeenCalled();

        const [eventsSql] = pool.execute.mock.calls[0];
        expect(eventsSql).toMatch(
            /LEFT JOIN students s ON c\.linked_student_id = s\.id\s+AND s\.academy_id = c\.academy_id/
        );
    });

    test('5xx → { error: 한국어 }', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB X'));
        const res = await request(makeApp())
            .get('/paca/consultations/calendar/events?startDate=2026-05-01&endDate=2026-05-31');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('서버 오류가 발생했습니다.');
    });
});

describe('GET /paca/consultations/booked-times', () => {
    beforeEach(() => resetMocks());

    test('date 누락 → 400', async () => {
        const res = await request(makeApp()).get('/paca/consultations/booked-times');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('날짜가 필요합니다.');
    });

    test('정상 → { date, bookedTimes: HH:MM 5자리 }', async () => {
        pool.execute.mockResolvedValueOnce([[
            { preferred_time: '14:00:00' },
            { preferred_time: '15:30:00' },
        ]]);

        const res = await request(makeApp())
            .get('/paca/consultations/booked-times?date=2026-05-10');

        expect(res.status).toBe(200);
        expect(res.body.date).toBe('2026-05-10');
        expect(res.body.bookedTimes).toEqual(['14:00', '15:30']);
    });
});

describe('GET /paca/consultations/by-student/:studentId', () => {
    beforeEach(() => resetMocks());

    test('미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .get('/paca/consultations/by-student/999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('연결된 상담 정보가 없습니다.');
    });

    test('정상 → { consultation } root 키 + 복호화 + JSON 파싱', async () => {
        pool.execute.mockResolvedValueOnce([[{
            id: 5,
            student_name: 'enc:홍길동',
            parent_name: 'enc:홍부모',
            parent_phone: 'enc:01011112222',
            checklist: '[{"id":1,"text":"a","checked":true}]',
            referral_sources: '["블로그"]',
        }]]);

        const res = await request(makeApp())
            .get('/paca/consultations/by-student/5');

        expect(res.status).toBe(200);
        expect(res.body.consultation).toBeDefined();
        expect(res.body.consultation.student_name).toBe('홍길동');
        expect(res.body.consultation.parent_name).toBe('홍부모');
        expect(res.body.consultation.parent_phone).toBe('01011112222');
        expect(res.body.consultation.checklist).toEqual([{ id: 1, text: 'a', checked: true }]);
        expect(res.body.consultation.referral_sources).toEqual(['블로그']);
    });
});
