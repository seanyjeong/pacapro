/**
 * routes/consultations/list-detail.js 테스트 (Phase 3 #2)
 *
 * 회귀 보호 범위:
 *   - 3 endpoint 응답 표면 (ADR-013):
 *     GET /         → { consultations, pagination, stats } — root 키 셋 보존
 *     GET /:id      → { ...consultation, academicScores, referralSources, checklist } — root spread
 *     DELETE /:id   → { message }
 *   - 페이징 (page/limit) + 필터 (status / startDate / endDate / search / consultationType)
 *   - 학생 매칭 (이름+전화번호 키 매핑) → matched_student_status
 *   - DB 호출 패턴 (ADR-005): pool.execute 만
 *   - decrypt 시그니처 보존 (ADR-007)
 *   - 5xx 한국어 메시지 + e.message 누출 0건
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
    require('../../../routes/consultations/list-detail')(router);
    app.use('/paca/consultations', router);
    return app;
}

function resetMocks() {
    pool.execute.mockReset();
    pool.query.mockReset();
}

describe('GET /paca/consultations', () => {
    beforeEach(() => resetMocks());

    test('필터 없이 → COUNT + SELECT + GROUP BY status 3회 호출, root 키 { consultations, pagination, stats }', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 0 }]]) // COUNT
            .mockResolvedValueOnce([[]]) // SELECT consultations
            .mockResolvedValueOnce([[{ status: 'pending', count: 5 }]]); // GROUP BY status

        const res = await request(makeApp()).get('/paca/consultations');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('consultations');
        expect(res.body).toHaveProperty('pagination');
        expect(res.body).toHaveProperty('stats');
        expect(res.body.pagination).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
        expect(res.body.stats).toEqual({ pending: 5 });
        expect(pool.execute).toHaveBeenCalledTimes(3);
        expect(pool.query).not.toHaveBeenCalled();

        const [selectSql] = pool.execute.mock.calls[1];
        expect(selectSql).toMatch(
            /LEFT JOIN students s ON c\.linked_student_id = s\.id\s+AND s\.academy_id = c\.academy_id/
        );
    });

    test('search 필터 → WHERE 추가, params 에 LIKE term 3개 push', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);

        await request(makeApp())
            .get(`/paca/consultations?search=${encodeURIComponent('홍')}&status=pending&consultationType=new_registration`);

        // SELECT consultations 의 params 에 status + consultationType + search %홍% 3건 + LIMIT/OFFSET 포함
        const selectCall = pool.execute.mock.calls[1];
        expect(selectCall[1]).toContain('pending');
        expect(selectCall[1]).toContain('new_registration');
        expect(selectCall[1]).toContain('%홍%');
    });

    test('completed 상담 있을 때 → 학생 매칭 SELECT 추가 (4번째 호출), matched_student_status 채움', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 1 }]]) // COUNT
            .mockResolvedValueOnce([[{ // SELECT consultations
                id: 1,
                status: 'completed',
                student_name: 'enc:홍길동',
                parent_phone: 'enc:01011112222',
                academic_scores: null,
                referral_sources: null,
            }]])
            .mockResolvedValueOnce([[]]) // GROUP BY status stats
            .mockResolvedValueOnce([[{ // 학생 목록 (학생 매칭용)
                id: 100,
                name: 'enc:홍길동',
                phone: 'enc:01099998888',
                parent_phone: 'enc:01011112222',
                status: 'active',
                is_trial: 0,
                trial_dates: '[]', // 체험 이력 없음
            }]]);

        const res = await request(makeApp()).get('/paca/consultations');

        expect(res.status).toBe(200);
        expect(res.body.consultations).toHaveLength(1);
        expect(res.body.consultations[0].matched_student_status).toBe('registered_direct');
    });

    test('5xx → { error: 한국어 } + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB internal'));
        const res = await request(makeApp()).get('/paca/consultations');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('서버 오류가 발생했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB internal');
    });
});

describe('GET /paca/consultations/:id', () => {
    beforeEach(() => resetMocks());

    test('미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/consultations/999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('상담 신청을 찾을 수 없습니다.');
    });

    test('정상 → root spread + academicScores/referralSources/checklist 추가 키', async () => {
        pool.execute.mockResolvedValueOnce([[{
            id: 5,
            student_name: 'enc:홍길동',
            parent_name: 'enc:홍부모',
            parent_phone: 'enc:01011112222',
            academic_scores: '{"schoolGradeAvg": 3.5}',
            referral_sources: '["블로그"]',
            checklist: '[{"id":1,"text":"a","checked":false}]',
        }]]);

        const res = await request(makeApp()).get('/paca/consultations/5');

        expect(res.status).toBe(200);
        // root spread (id, student_name 등이 root 에 직접 노출)
        expect(res.body.id).toBe(5);
        expect(res.body.student_name).toBe('홍길동');
        // 추가 파싱 키
        expect(res.body.academicScores).toEqual({ schoolGradeAvg: 3.5 });
        expect(res.body.referralSources).toEqual(['블로그']);
        expect(res.body.checklist).toEqual([{ id: 1, text: 'a', checked: false }]);

        const [detailSql] = pool.execute.mock.calls[0];
        expect(detailSql).toMatch(
            /LEFT JOIN students s ON c\.linked_student_id = s\.id\s+AND s\.academy_id = c\.academy_id/
        );
    });
});

describe('DELETE /paca/consultations/:id', () => {
    beforeEach(() => resetMocks());

    test('미존재 → 404', async () => {
        pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
        const res = await request(makeApp()).delete('/paca/consultations/999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('상담 신청을 찾을 수 없습니다.');
    });

    test('정상 → 200 + { message }', async () => {
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp()).delete('/paca/consultations/5');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('상담 신청이 삭제되었습니다.');
    });
});
