/**
 * paca/seasons/list.js — 시즌 목록·상세 조회 라우터 (read-only)
 *
 * 마운트: paca.js → routes/seasons/index.js → require('./list')(router)
 *         mount path: '/paca/seasons'
 *
 * Endpoint (3건):
 *   - GET  /        — 학원 시즌 전체 목록 + 종료일 지난 active 자동 ended 처리 (status / season_type 필터 옵션)
 *   - GET  /active  — 오늘 기준 active 시즌 (다중 가능, season_type 정렬). /:id 보다 먼저 등록 필수
 *   - GET  /:id     — 시즌 상세 + 등록 학생 수 (cancelled 제외)
 *
 * 인증: 3건 모두 verifyToken 만 (조회 — checkPermission 없음).
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/seasons.ts (getSeasons / getActiveSeasons / getSeason):
 *     - GET  /        → { message, seasons }       (response.seasons 직접 소비)
 *     - GET  /active  → { message, seasons }
 *     - GET  /:id     → { season }                  (root 키 season — message 없음, 의도적으로 보존)
 *     - 4xx/5xx        → { error, message }
 *   /:id 응답에는 enrolled_students 필드가 season 객체 내부에 추가됨 (프론트가 활용).
 *
 * DB 호출 (ADR-005): pool.execute. 5건. db.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt 사용 X (시즌 메타데이터만 — 학생 이름 미접촉).
 *
 * 분리 결정 (ADR-006): 단일 파일 ~150줄 — 분리 불요.
 *
 * GET / 의 GET 응답 root key 'seasons' 가 GET /paca/seasons/active 와 동일 — 클라이언트는
 *   엔드포인트 별로 분기하기 때문에 root 키 통일 가능 보존.
 */

const { pool, logger } = require('./_utils');
const { verifyToken } = require('../../middleware/auth');

module.exports = function(router) {

router.get('/', verifyToken, async (req, res) => {
    try {
        const { status, season_type } = req.query;

        await pool.execute(
            `UPDATE seasons SET status = 'ended' WHERE academy_id = ? AND status = 'active' AND season_end_date < CURDATE()`,
            [req.user.academyId]
        );

        let query = `
            SELECT * FROM seasons
            WHERE academy_id = ?
        `;
        const params = [req.user.academyId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (season_type) {
            query += ' AND season_type = ?';
            params.push(season_type);
        }

        query += ' ORDER BY season_start_date DESC';

        const [seasons] = await pool.execute(query, params);

        res.json({
            message: `Found ${seasons.length} seasons`,
            seasons
        });
    } catch (error) {
        logger.error('Error fetching seasons:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 목록을 불러오지 못했습니다.'
        });
    }
});

router.get('/active', verifyToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const [seasons] = await pool.execute(
            `SELECT * FROM seasons
            WHERE academy_id = ?
            AND status = 'active'
            AND season_start_date <= ?
            AND season_end_date >= ?
            ORDER BY season_type`,
            [req.user.academyId, today, today]
        );

        res.json({
            message: `Found ${seasons.length} active season(s)`,
            seasons
        });
    } catch (error) {
        logger.error('Error fetching active seasons:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '활성 시즌을 불러오지 못했습니다.'
        });
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const [seasons] = await pool.execute(
            `SELECT * FROM seasons
            WHERE id = ? AND academy_id = ?`,
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        const [enrolledCount] = await pool.execute(
            `SELECT COUNT(*) as count FROM student_seasons
            WHERE season_id = ? AND payment_status != 'cancelled'`,
            [seasonId]
        );

        const season = seasons[0];
        season.enrolled_students = enrolledCount[0].count;

        res.json({ season });
    } catch (error) {
        logger.error('Error fetching season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 정보를 불러오지 못했습니다.'
        });
    }
});

};
