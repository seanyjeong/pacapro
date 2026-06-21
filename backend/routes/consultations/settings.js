/**
 * routes/consultations/settings — 상담 설정 (Phase 3 #2)
 *
 * Endpoints:
 *   GET    /settings/info             — 학원 정보 + 상담 설정 + 요일별 운영 시간 + 차단 시간대 조회
 *   PUT    /settings/info             — 상담 설정 수정 (slug + UPSERT)
 *   PUT    /settings/weekly-hours     — 요일별 운영 시간 7일 세트 수정 (DELETE → INSERT)
 *   POST   /settings/blocked-slots    — 시간대 차단 추가 (201)
 *   DELETE /settings/blocked-slots/:id — 시간대 차단 해제
 *
 * 인증: verifyToken (endpoint 단위, 원본 보존)
 *
 * DB: pool.execute (ADR-005). 단순 SELECT/UPSERT/INSERT/UPDATE/DELETE.
 *
 * 응답 표면 보존 (ADR-013):
 *   - GET /settings/info : { academy, settings, weeklyHours, blockedSlots } — 프론트 SettingsResponse 직접 소비
 *   - PUT /settings/info : { error } 4xx | { message } 200
 *   - PUT /settings/weekly-hours : { error } 400 | { message } 200
 *   - POST /settings/blocked-slots : { error } 400 | { message, id } 201
 *   - DELETE /settings/blocked-slots/:id : { error } 404 | { message } 200
 *   - 5xx : { error: '<한국어>' } — e.message 누출 0건 (ADR-003)
 *
 * 보안 (ADR-007): 본 sub-라우터는 암호화 헬퍼 호출 X (학원 메타/요일/차단 시간대만 처리).
 */

const { pool, verifyToken, logger } = require('./_utils');

module.exports = function (router) {
    // ============================================
    // GET /paca/consultations/settings/info — 상담 설정 조회
    // ============================================
    router.get('/settings/info', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;

            // 학원 정보 (slug 포함)
            const [academies] = await pool.execute(
                'SELECT id, name, slug FROM academies WHERE id = ?',
                [academyId]
            );

            // 상담 설정 조회
            const [settings] = await pool.execute(
                'SELECT * FROM consultation_settings WHERE academy_id = ?',
                [academyId]
            );

            // 요일별 운영 시간
            const [weeklyHours] = await pool.execute(
                `SELECT day_of_week, is_available, start_time, end_time
                 FROM consultation_weekly_hours
                 WHERE academy_id = ?
                 ORDER BY day_of_week`,
                [academyId]
            );

            // 차단된 날짜들
            const [blockedSlots] = await pool.execute(
                `SELECT id, blocked_date, is_all_day, start_time, end_time, reason
                 FROM consultation_blocked_slots
                 WHERE academy_id = ? AND blocked_date >= CURDATE()
                 ORDER BY blocked_date`,
                [academyId]
            );

            const setting = settings[0] || {};

            res.json({
                academy: academies[0],
                settings: {
                    isEnabled: setting.is_enabled ?? true,
                    pageTitle: setting.page_title || '상담 예약',
                    pageDescription: setting.page_description || '',
                    slotDuration: setting.slot_duration || 30,
                    maxReservationsPerSlot: setting.max_reservations_per_slot || 1,
                    advanceDays: setting.advance_days || 30,
                    referralSources: setting.referral_sources
                        ? (typeof setting.referral_sources === 'string'
                            ? JSON.parse(setting.referral_sources)
                            : setting.referral_sources)
                        : ['블로그/인터넷 검색', '지인 소개', '현수막/전단지', 'SNS', '기타'],
                    sendConfirmationAlimtalk: setting.send_confirmation_alimtalk ?? true,
                    confirmationTemplateCode: setting.confirmation_template_code || '',
                    minAdvanceHours: setting.min_advance_hours ?? 4
                },
                weeklyHours: weeklyHours.map((h) => ({
                    dayOfWeek: h.day_of_week,
                    isAvailable: h.is_available === 1,
                    startTime: h.start_time,
                    endTime: h.end_time
                })),
                blockedSlots
            });
        } catch (error) {
            logger.error('상담 설정 조회 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });

    // ============================================
    // PUT /paca/consultations/settings/info — 상담 설정 수정
    // ============================================
    router.put('/settings/info', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;
            const {
                slug,
                isEnabled,
                pageTitle,
                pageDescription,
                slotDuration,
                maxReservationsPerSlot,
                advanceDays,
                referralSources,
                sendConfirmationAlimtalk,
                confirmationTemplateCode,
                minAdvanceHours
            } = req.body;

            // slug 업데이트 (학원 테이블)
            if (slug !== undefined && slug !== '') {
                // slug 유효성 검사
                if (!/^[a-z0-9-]+$/.test(slug)) {
                    return res.status(400).json({ error: 'slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' });
                }

                // 중복 체크
                const [existing] = await pool.execute(
                    'SELECT id FROM academies WHERE slug = ? AND id != ?',
                    [slug, academyId]
                );

                if (existing.length > 0) {
                    return res.status(409).json({ error: '이미 사용 중인 주소입니다.' });
                }

                await pool.execute('UPDATE academies SET slug = ? WHERE id = ?', [slug, academyId]);
            }

            // 설정 UPSERT
            await pool.execute(
                `INSERT INTO consultation_settings (
                    academy_id, is_enabled, page_title, page_description,
                    slot_duration, max_reservations_per_slot, advance_days,
                    referral_sources, send_confirmation_alimtalk, confirmation_template_code,
                    min_advance_hours
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    is_enabled = VALUES(is_enabled),
                    page_title = VALUES(page_title),
                    page_description = VALUES(page_description),
                    slot_duration = VALUES(slot_duration),
                    max_reservations_per_slot = VALUES(max_reservations_per_slot),
                    advance_days = VALUES(advance_days),
                    referral_sources = VALUES(referral_sources),
                    send_confirmation_alimtalk = VALUES(send_confirmation_alimtalk),
                    confirmation_template_code = VALUES(confirmation_template_code),
                    min_advance_hours = VALUES(min_advance_hours)`,
                [
                    academyId,
                    isEnabled ?? true,
                    pageTitle || '상담 예약',
                    pageDescription || '',
                    slotDuration || 30,
                    maxReservationsPerSlot || 1,
                    advanceDays || 30,
                    referralSources ? JSON.stringify(referralSources) : '["블로그/인터넷 검색", "지인 소개", "현수막/전단지", "SNS", "기타"]',
                    sendConfirmationAlimtalk ?? true,
                    confirmationTemplateCode || null,
                    minAdvanceHours ?? 4
                ]
            );

            res.json({ message: '설정이 저장되었습니다.' });
        } catch (error) {
            logger.error('상담 설정 수정 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });

    // ============================================
    // PUT /paca/consultations/settings/weekly-hours — 요일별 운영 시간 수정
    // ============================================
    router.put('/settings/weekly-hours', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;
            const { weeklyHours } = req.body;

            if (!Array.isArray(weeklyHours) || weeklyHours.length !== 7) {
                return res.status(400).json({ error: '7일 치 운영 시간 정보가 필요합니다.' });
            }

            // 기존 데이터 삭제 후 재생성
            await pool.execute('DELETE FROM consultation_weekly_hours WHERE academy_id = ?', [academyId]);

            for (const hour of weeklyHours) {
                await pool.execute(
                    `INSERT INTO consultation_weekly_hours
                     (academy_id, day_of_week, is_available, start_time, end_time)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        academyId,
                        hour.dayOfWeek,
                        hour.isAvailable,
                        hour.startTime || null,
                        hour.endTime || null
                    ]
                );
            }

            res.json({ message: '운영 시간이 저장되었습니다.' });
        } catch (error) {
            logger.error('운영 시간 수정 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });

    // ============================================
    // POST /paca/consultations/settings/blocked-slots — 시간대 차단 추가
    // ============================================
    router.post('/settings/blocked-slots', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;
            const userId = req.user.id;
            const { blockedDate, isAllDay, startTime, endTime, reason } = req.body;

            if (!blockedDate) {
                return res.status(400).json({ error: '날짜를 선택해주세요.' });
            }

            const [result] = await pool.execute(
                `INSERT INTO consultation_blocked_slots
                 (academy_id, blocked_date, is_all_day, start_time, end_time, reason, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    academyId,
                    blockedDate,
                    isAllDay ?? true,
                    isAllDay ? null : startTime,
                    isAllDay ? null : endTime,
                    reason || null,
                    userId
                ]
            );

            res.status(201).json({
                message: '시간대가 차단되었습니다.',
                id: result.insertId
            });
        } catch (error) {
            logger.error('시간대 차단 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });

    // ============================================
    // DELETE /paca/consultations/settings/blocked-slots/:id — 시간대 차단 해제
    // ============================================
    router.delete('/settings/blocked-slots/:id', verifyToken, async (req, res) => {
        try {
            const { id } = req.params;
            const academyId = req.user.academy_id;

            const [result] = await pool.execute(
                'DELETE FROM consultation_blocked_slots WHERE id = ? AND academy_id = ?',
                [id, academyId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: '차단된 시간대를 찾을 수 없습니다.' });
            }

            res.json({ message: '차단이 해제되었습니다.' });
        } catch (error) {
            logger.error('차단 해제 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });
};
