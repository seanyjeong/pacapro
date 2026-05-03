/**
 * routes/consultations/settings.js 테스트 (Phase 3 #2)
 *
 * 회귀 보호 범위:
 *   - 5 endpoint × 응답 표면 (ADR-013 보존):
 *     GET /settings/info             → { academy, settings, weeklyHours, blockedSlots }
 *     PUT /settings/info             → { message } (200), { error } (400/409)
 *     PUT /settings/weekly-hours     → { message } (200), { error } (400)
 *     POST /settings/blocked-slots   → { message, id } (201), { error } (400)
 *     DELETE /settings/blocked-slots/:id → { message } (200), { error } (404)
 *   - DB 호출 패턴 (ADR-005): pool.execute 만 (db.query / pool.query 잔존 0건)
 *   - 한국어 친화 메시지 (ADR-003) + e.message 누출 0건
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

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/consultations/settings')(router);
    app.use('/paca/consultations', router);
    return app;
}

function resetMocks() {
    pool.execute.mockReset();
    pool.query.mockReset();
}

describe('GET /paca/consultations/settings/info', () => {
    beforeEach(() => resetMocks());

    test('정상 → academy + settings + weeklyHours + blockedSlots root 키 반환', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, name: '학원A', slug: 'academy-a' }]])
            .mockResolvedValueOnce([[{
                is_enabled: 1,
                page_title: '상담 예약',
                slot_duration: 30,
                referral_sources: '["블로그", "지인"]',
                send_confirmation_alimtalk: 1,
                min_advance_hours: 4,
            }]])
            .mockResolvedValueOnce([[{ day_of_week: 0, is_available: 1, start_time: '10:00', end_time: '20:00' }]])
            .mockResolvedValueOnce([[{ id: 5, blocked_date: '2026-05-10', is_all_day: 1 }]]);

        const res = await request(makeApp()).get('/paca/consultations/settings/info');

        expect(res.status).toBe(200);
        expect(res.body.academy).toEqual({ id: 1, name: '학원A', slug: 'academy-a' });
        expect(res.body.settings.pageTitle).toBe('상담 예약');
        expect(res.body.settings.referralSources).toEqual(['블로그', '지인']);
        expect(res.body.weeklyHours).toEqual([
            { dayOfWeek: 0, isAvailable: true, startTime: '10:00', endTime: '20:00' },
        ]);
        expect(res.body.blockedSlots).toHaveLength(1);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('settings row 없으면 기본값 적용', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, name: 'A' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);

        const res = await request(makeApp()).get('/paca/consultations/settings/info');

        expect(res.status).toBe(200);
        expect(res.body.settings.pageTitle).toBe('상담 예약');
        expect(res.body.settings.slotDuration).toBe(30);
        expect(res.body.settings.referralSources).toEqual(
            ['블로그/인터넷 검색', '지인 소개', '현수막/전단지', 'SNS', '기타']
        );
    });

    test('5xx → { error: 한국어 } + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB internal'));

        const res = await request(makeApp()).get('/paca/consultations/settings/info');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('서버 오류가 발생했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB internal');
    });
});

describe('PUT /paca/consultations/settings/info', () => {
    beforeEach(() => resetMocks());

    test('slug 형식 위반 → 400', async () => {
        const res = await request(makeApp())
            .put('/paca/consultations/settings/info')
            .send({ slug: 'INVALID UPPER' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('영문 소문자');
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test('slug 중복 → 409', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 99 }]]);

        const res = await request(makeApp())
            .put('/paca/consultations/settings/info')
            .send({ slug: 'taken' });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('이미 사용 중인 주소입니다.');
    });

    test('정상 UPSERT → { message }', async () => {
        // slug 미포함 → academies 조회 skip, UPSERT 1건만 호출
        pool.execute.mockResolvedValueOnce([{}]);

        const res = await request(makeApp())
            .put('/paca/consultations/settings/info')
            .send({ pageTitle: '새 상담 예약' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('설정이 저장되었습니다.');
        expect(pool.execute).toHaveBeenCalledTimes(1);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('5xx → { error: 한국어 }', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB X'));
        const res = await request(makeApp())
            .put('/paca/consultations/settings/info')
            .send({});
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('서버 오류가 발생했습니다.');
    });
});

describe('PUT /paca/consultations/settings/weekly-hours', () => {
    beforeEach(() => resetMocks());

    test('weeklyHours 길이 != 7 → 400', async () => {
        const res = await request(makeApp())
            .put('/paca/consultations/settings/weekly-hours')
            .send({ weeklyHours: [{ dayOfWeek: 0 }] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('7일 치 운영 시간 정보가 필요합니다.');
    });

    test('정상 7일 → DELETE 1 + INSERT 7 = pool.execute 8회 호출', async () => {
        pool.execute.mockResolvedValue([{}]);

        const weeklyHours = Array.from({ length: 7 }, (_, i) => ({
            dayOfWeek: i,
            isAvailable: true,
            startTime: '10:00',
            endTime: '20:00',
        }));

        const res = await request(makeApp())
            .put('/paca/consultations/settings/weekly-hours')
            .send({ weeklyHours });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('운영 시간이 저장되었습니다.');
        expect(pool.execute).toHaveBeenCalledTimes(8);
        expect(pool.query).not.toHaveBeenCalled();
    });
});

describe('POST /paca/consultations/settings/blocked-slots', () => {
    beforeEach(() => resetMocks());

    test('blockedDate 누락 → 400', async () => {
        const res = await request(makeApp())
            .post('/paca/consultations/settings/blocked-slots')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('날짜를 선택해주세요.');
    });

    test('정상 → 201 + { message, id }', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 42 }]);

        const res = await request(makeApp())
            .post('/paca/consultations/settings/blocked-slots')
            .send({ blockedDate: '2026-05-15', isAllDay: true });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('시간대가 차단되었습니다.');
        expect(res.body.id).toBe(42);
    });
});

describe('DELETE /paca/consultations/settings/blocked-slots/:id', () => {
    beforeEach(() => resetMocks());

    test('미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
        const res = await request(makeApp())
            .delete('/paca/consultations/settings/blocked-slots/999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('차단된 시간대를 찾을 수 없습니다.');
    });

    test('정상 → 200 + { message }', async () => {
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp())
            .delete('/paca/consultations/settings/blocked-slots/5');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('차단이 해제되었습니다.');
    });
});
