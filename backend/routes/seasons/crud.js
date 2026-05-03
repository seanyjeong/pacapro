/**
 * paca/seasons/crud.js — 시즌 CRUD (생성/수정/삭제) 라우터
 *
 * 마운트: paca.js → routes/seasons/index.js → require('./crud')(router)
 *         mount path: '/paca/seasons'
 *
 * Endpoint (3건):
 *   - POST   /        — 신규 시즌 생성 (status='upcoming' 기본)
 *   - PUT    /:id     — 시즌 dynamic update (13 필드 + 'active' 전환 시 학생 자동 배정)
 *   - DELETE /:id     — 소프트 삭제 (status='ended', enrolled student 0명일 때만)
 *
 * 인증:
 *   - POST/PUT  → verifyToken + checkPermission('seasons', 'edit')
 *   - DELETE    → verifyToken + requireRole('owner') (소유자만)
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/seasons.ts (createSeason / updateSeason / deleteSeason):
 *     - POST   /     → 201 { message, season }                      (response.season 직접 소비)
 *     - PUT    /:id  → 200 { message, season, scheduleAssignment } (active 전환 시 scheduleAssignment 채워짐)
 *     - DELETE /:id  → 200 { message, season:{id, season_name} }
 *     - 4xx/5xx       → { error, message }
 *
 * DB 호출 (ADR-005): pool.execute. 7건. db.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt 사용 X (시즌 메타데이터). bcrypt/JWT/결제 외부 X.
 *
 * 거대 dynamic update 분리 미루기 (ADR-015):
 *   PUT /:id 는 13 필드 dynamic update + 'active' 전환 사이드이펙트 (autoAssignAll) 강결합.
 *   본 phase 는 ADR-005/003 + JSDoc 정렬만 단독 진행. 별도 트랙 (응답 표면 표준화 + autoAssign 분리)
 *   진입 시 분리 검토.
 */

const {
    pool,
    logger,
    autoAssignAllSeasonStudentsToSchedules
} = require('./_utils');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

router.post('/', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    try {
        const {
            season_name,
            season_type,
            season_start_date,
            season_end_date,
            non_season_end_date,
            operating_days,
            grade_time_slots,
            default_season_fee,
            allows_continuous,
            continuous_to_season_type,
            continuous_discount_type,
            continuous_discount_rate
        } = req.body;

        if (!season_name || !season_type || !season_start_date || !season_end_date || !non_season_end_date || !operating_days) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Required fields: season_name, season_type, season_start_date, season_end_date, non_season_end_date, operating_days'
            });
        }

        if (!['early', 'regular'].includes(season_type)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'season_type must be early or regular'
            });
        }

        const nonSeasonEnd = new Date(non_season_end_date);
        const seasonStart = new Date(season_start_date);
        const seasonEnd = new Date(season_end_date);

        if (nonSeasonEnd >= seasonStart) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'non_season_end_date must be before season_start_date'
            });
        }

        if (seasonStart >= seasonEnd) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'season_start_date must be before season_end_date'
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO seasons (
                academy_id,
                season_name,
                season_type,
                season_start_date,
                season_end_date,
                non_season_end_date,
                operating_days,
                grade_time_slots,
                default_season_fee,
                allows_continuous,
                continuous_to_season_type,
                continuous_discount_type,
                continuous_discount_rate,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')`,
            [
                req.user.academyId,
                season_name,
                season_type,
                season_start_date,
                season_end_date,
                non_season_end_date,
                JSON.stringify(operating_days),
                grade_time_slots ? JSON.stringify(grade_time_slots) : null,
                default_season_fee || 0,
                allows_continuous || false,
                continuous_to_season_type || null,
                continuous_discount_type || 'none',
                continuous_discount_rate || 0
            ]
        );

        const [created] = await pool.execute(
            'SELECT * FROM seasons WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            message: 'Season created successfully',
            season: created[0]
        });
    } catch (error) {
        logger.error('Error creating season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 생성에 실패했습니다.'
        });
    }
});

router.put('/:id', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const [seasons] = await pool.execute(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        const {
            season_name,
            season_type,
            season_start_date,
            season_end_date,
            non_season_end_date,
            operating_days,
            grade_time_slots,
            default_season_fee,
            allows_continuous,
            continuous_to_season_type,
            continuous_discount_type,
            continuous_discount_rate,
            status
        } = req.body;

        const updates = [];
        const params = [];

        if (season_name !== undefined) {
            updates.push('season_name = ?');
            params.push(season_name);
        }
        if (season_type !== undefined) {
            updates.push('season_type = ?');
            params.push(season_type);
        }
        if (season_start_date !== undefined) {
            updates.push('season_start_date = ?');
            params.push(season_start_date);
        }
        if (season_end_date !== undefined) {
            updates.push('season_end_date = ?');
            params.push(season_end_date);
        }
        if (non_season_end_date !== undefined) {
            updates.push('non_season_end_date = ?');
            params.push(non_season_end_date);
        }
        if (operating_days !== undefined) {
            updates.push('operating_days = ?');
            params.push(JSON.stringify(operating_days));
        }
        if (grade_time_slots !== undefined) {
            updates.push('grade_time_slots = ?');
            params.push(grade_time_slots ? JSON.stringify(grade_time_slots) : null);
        }
        if (default_season_fee !== undefined) {
            updates.push('default_season_fee = ?');
            params.push(default_season_fee);
        }
        if (allows_continuous !== undefined) {
            updates.push('allows_continuous = ?');
            params.push(allows_continuous);
        }
        if (continuous_to_season_type !== undefined) {
            updates.push('continuous_to_season_type = ?');
            params.push(continuous_to_season_type);
        }
        if (continuous_discount_type !== undefined) {
            updates.push('continuous_discount_type = ?');
            params.push(continuous_discount_type);
        }
        if (continuous_discount_rate !== undefined) {
            updates.push('continuous_discount_rate = ?');
            params.push(continuous_discount_rate);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(seasonId);

        const oldSeason = seasons[0];
        const wasActive = oldSeason.status === 'active';
        const willBeActive = status === 'active';

        await pool.execute(
            `UPDATE seasons SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const [updated] = await pool.execute(
            'SELECT * FROM seasons WHERE id = ?',
            [seasonId]
        );

        let scheduleResult = null;
        if (!wasActive && willBeActive) {
            logger.info(`Season ${seasonId} activated - auto-assigning students to schedules`);
            scheduleResult = await autoAssignAllSeasonStudentsToSchedules(seasonId, req.user.academyId);
        }

        res.json({
            message: 'Season updated successfully',
            season: updated[0],
            scheduleAssignment: scheduleResult
        });
    } catch (error) {
        logger.error('Error updating season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 수정에 실패했습니다.'
        });
    }
});

router.delete('/:id', verifyToken, requireRole('owner'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const [seasons] = await pool.execute(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        const [enrolled] = await pool.execute(
            `SELECT COUNT(*) as count FROM student_seasons
            WHERE season_id = ? AND payment_status != 'cancelled'`,
            [seasonId]
        );

        if (enrolled[0].count > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `Cannot delete season with ${enrolled[0].count} enrolled students`
            });
        }

        await pool.execute(
            `UPDATE seasons SET status = 'ended', updated_at = NOW() WHERE id = ?`,
            [seasonId]
        );

        res.json({
            message: 'Season deactivated successfully',
            season: {
                id: seasonId,
                season_name: seasons[0].season_name
            }
        });
    } catch (error) {
        logger.error('Error deleting season:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 삭제에 실패했습니다.'
        });
    }
});

};
