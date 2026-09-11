const { consultationSnapshot } = require('../utils/consultationBridgeSnapshot');
const COLUMNS = { preferredDate: 'preferred_date', preferredTime: 'preferred_time',
    adminNotes: 'admin_notes', consultationMemo: 'consultation_memo' };

class ConsultationBridgeRepository {
    constructor(pool, decryptRow) { this.pool = pool; this.decryptRow = decryptRow; }

    async change(academyId, consultationId, expectedHash, changes, remove) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                'SELECT * FROM consultations WHERE id = ? AND academy_id = ? FOR UPDATE', [consultationId, academyId]);
            if (!rows.length) { await connection.rollback(); return 'not_found'; }
            if (consultationSnapshot(this.decryptRow({ ...rows[0] })) !== expectedHash) {
                await connection.rollback(); return 'changed';
            }
            if (remove) await connection.execute('DELETE FROM consultations WHERE id = ? AND academy_id = ?', [consultationId, academyId]);
            else {
                const keys = Object.keys(changes);
                const values = keys.map((key) => key === 'preferredTime' ? `${changes[key]}:00` : changes[key]);
                await connection.execute(`UPDATE consultations SET ${keys.map((key) => `${COLUMNS[key]} = ?`).join(', ')}
                    WHERE id = ? AND academy_id = ?`, [...values, consultationId, academyId]);
            }
            await connection.commit();
            return 'applied';
        } catch (error) { await connection.rollback(); throw error; }
        finally { connection.release(); }
    }
}

module.exports = { ConsultationBridgeRepository };
