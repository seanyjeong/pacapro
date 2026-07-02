const db = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const {
    DEFAULT_SEASON_MONTHLY_POLICY,
    isSeasonMonthlyPolicy,
    parseSettings,
} = require('../../utils/seasonMonthlyPolicy');
const { normalizeTuitionSettings } = require('../../utils/tuitionSettings');

module.exports = function registerAcademySettingsRoutes(router) {
    router.get('/academy', verifyToken, async (req, res) => {
        try {
            const settings = await loadAcademySettings(req.user.academyId);
            if (!settings) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '학원을 찾지 못했습니다.',
                });
            }

            res.json({
                message: '학원 설정을 불러왔습니다.',
                settings,
            });
        } catch (error) {
            logger.error('Error fetching academy settings:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '학원 설정을 불러오지 못했습니다.',
            });
        }
    });

    router.put('/academy', verifyToken, checkPermission('settings', 'edit'), async (req, res) => {
        try {
            if (!validateSeasonMonthlyPolicy(req, res)) return;

            await updateAcademyProfile(req.user.academyId, req.body);
            await saveTuitionSettings(req.user.academyId, req.body);

            const settings = await loadAcademySettings(req.user.academyId);
            res.json({
                message: '학원 설정이 저장되었습니다.',
                settings,
            });
        } catch (error) {
            logger.error('Error updating academy settings:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '학원 설정을 저장하지 못했습니다.',
            });
        }
    });
};

async function loadAcademySettings(academyId) {
    const [academyRows] = await db.query('SELECT * FROM academies WHERE id = ?', [academyId]);
    if (academyRows.length === 0) return null;

    const [settingsRows] = await db.query('SELECT * FROM academy_settings WHERE academy_id = ?', [academyId]);
    return buildAcademySettings(academyRows[0], settingsRows[0]);
}

function buildAcademySettings(academy, settingsRow) {
    const parsed = parseSettings(settingsRow?.settings);
    const tuitionSettings = normalizeTuitionSettings(parsed);
    return {
        academy_name: academy.name || '',
        phone: academy.phone || '',
        address: academy.address || '',
        business_number: academy.business_number || '',
        tuition_due_day: settingsRow?.tuition_due_day || 5,
        morning_class_time: settingsRow?.morning_class_time || '09:30-12:00',
        afternoon_class_time: settingsRow?.afternoon_class_time || '14:00-18:00',
        evening_class_time: settingsRow?.evening_class_time || '18:30-21:00',
        ...tuitionSettings,
        season_monthly_policy: isSeasonMonthlyPolicy(parsed.season_monthly_policy)
            ? parsed.season_monthly_policy
            : DEFAULT_SEASON_MONTHLY_POLICY,
    };
}

function validateSeasonMonthlyPolicy(req, res) {
    const { season_monthly_policy } = req.body;
    if (season_monthly_policy === undefined || isSeasonMonthlyPolicy(season_monthly_policy)) return true;
    res.status(400).json({
        error: 'Validation Error',
        message: '시즌 월납부 처리 방식을 확인해주세요.',
    });
    return false;
}

async function updateAcademyProfile(academyId, body) {
    const fieldMap = {
        academy_name: 'name',
        phone: 'phone',
        address: 'address',
        business_number: 'business_number',
    };
    const updates = [];
    const params = [];

    Object.entries(fieldMap).forEach(([bodyKey, column]) => {
        if (body[bodyKey] === undefined) return;
        updates.push(`${column} = ?`);
        params.push(body[bodyKey]);
    });

    if (updates.length === 0) return;
    params.push(academyId);
    await db.query(`UPDATE academies SET ${updates.join(', ')} WHERE id = ?`, params);
}

async function saveTuitionSettings(academyId, body) {
    const [existing] = await db.query(
        'SELECT id, settings FROM academy_settings WHERE academy_id = ?',
        [academyId]
    );
    const mergedSettings = buildMergedTuitionSettings(existing[0]?.settings, body);

    if (existing.length === 0) {
        await db.query(
            'INSERT INTO academy_settings (academy_id, tuition_due_day, settings) VALUES (?, ?, ?)',
            [academyId, body.tuition_due_day || 5, JSON.stringify(mergedSettings)]
        );
        return;
    }

    if (body.tuition_due_day !== undefined) {
        await db.query(
            'UPDATE academy_settings SET tuition_due_day = ? WHERE academy_id = ?',
            [body.tuition_due_day, academyId]
        );
    }

    await db.query(
        'UPDATE academy_settings SET settings = ? WHERE academy_id = ?',
        [JSON.stringify(mergedSettings), academyId]
    );
}

function buildMergedTuitionSettings(rawSettings, body) {
    const merged = {
        ...parseSettings(rawSettings),
    };
    if (body.exam_tuition !== undefined) merged.exam_tuition = body.exam_tuition || null;
    if (body.adult_tuition !== undefined) merged.adult_tuition = body.adult_tuition || null;
    if (body.season_fees !== undefined) merged.season_fees = body.season_fees || null;
    if (body.season_monthly_policy !== undefined) {
        merged.season_monthly_policy = body.season_monthly_policy;
    }
    const tuitionSettings = normalizeTuitionSettings(merged);
    if (!isSeasonMonthlyPolicy(merged.season_monthly_policy)) {
        merged.season_monthly_policy = DEFAULT_SEASON_MONTHLY_POLICY;
    }
    return {
        ...merged,
        ...tuitionSettings,
    };
}
