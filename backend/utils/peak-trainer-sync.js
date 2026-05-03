/**
 * pacapro → peak.trainers 동기화 유틸.
 * 강사 CRUD 성공 후 setImmediate 으로 비동기 호출한다.
 * 실패해도 pacapro 응답은 영향 없음 (best-effort).
 */

const db = require('../config/database');
const peakPool = require('../config/peak-database');
const { decrypt } = require('./encryption');

function safeDecryptField(v) {
    if (v && typeof v === 'string' && v.startsWith('ENC:')) {
        try { return decrypt(v); } catch { return v; }
    }
    return v;
}

async function syncPeakTrainerById(instructorId) {
    try {
        const [rows] = await db.query(
            'SELECT id, academy_id, name, phone, status, deleted_at FROM instructors WHERE id = ?',
            [instructorId]
        );
        if (rows.length === 0) {
            await peakPool.query(
                'UPDATE trainers SET active = 0, updated_at = NOW() WHERE paca_user_id = ?',
                [instructorId]
            );
            return { action: 'deactivated_missing' };
        }
        const i = rows[0];
        const name = safeDecryptField(i.name) || '이름없음';
        const phone = safeDecryptField(i.phone) || null;
        const active = (i.status === 'active' && !i.deleted_at) ? 1 : 0;

        await peakPool.query(`
            INSERT INTO trainers (academy_id, paca_user_id, name, phone, active)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                phone = VALUES(phone),
                active = VALUES(active),
                updated_at = NOW()
        `, [i.academy_id, i.id, name, phone, active]);
        return { action: 'upserted', active };
    } catch (e) {
        console.error('[peak-trainer-sync] failed id=' + instructorId, e.message);
        return { action: 'error', error: e.message };
    }
}

function syncPeakTrainerAsync(instructorId) {
    setImmediate(() => { syncPeakTrainerById(instructorId).catch(() => {}); });
}

module.exports = { syncPeakTrainerById, syncPeakTrainerAsync };
