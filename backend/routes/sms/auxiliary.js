const { verifyToken, checkPermission } = require('../../middleware/auth');
const { isValidPhoneNumber } = require('../../utils/naverSens');
const { decryptArrayFields } = require('../../utils/encryption');
const logger = require('../../utils/logger');

function registerSmsAuxiliaryRoutes(router, db) {
    router.get('/recipients-count', verifyToken, async (req, res) => {
        try {
            const { statusFilter = 'active', gradeFilter = 'all' } = req.query;
            let query = `
                SELECT s.phone AS student_phone, s.parent_phone, s.grade
                FROM students s
                WHERE s.academy_id = ?
                  AND s.status = ?
                  AND s.deleted_at IS NULL
            `;
            const queryParams = [req.user.academyId, statusFilter];

            if (gradeFilter === 'junior') {
                query += ` AND s.grade IN ('중1', '중2', '중3', '고1', '고2')`;
            } else if (gradeFilter === 'senior') {
                query += ` AND s.grade IN ('고3', 'N수')`;
            }

            let [students] = await db.query(query, queryParams);
            students = decryptArrayFields(students, ['student_phone', 'parent_phone']);

            const studentPhones = new Set();
            const parentPhones = new Set();
            const allPhones = new Set();

            students.forEach(student => {
                if (isValidPhoneNumber(student.student_phone)) {
                    studentPhones.add(student.student_phone.replace(/-/g, ''));
                }
                if (isValidPhoneNumber(student.parent_phone)) {
                    parentPhones.add(student.parent_phone.replace(/-/g, ''));
                }
                const effectivePhone = isValidPhoneNumber(student.parent_phone)
                    ? student.parent_phone
                    : isValidPhoneNumber(student.student_phone)
                        ? student.student_phone
                        : null;
                if (effectivePhone) allPhones.add(effectivePhone.replace(/-/g, ''));
            });

            res.json({
                all: allPhones.size,
                students: studentPhones.size,
                parents: parentPhones.size
            });
        } catch (error) {
            logger.error('수신자 수 조회 오류:', error);
            res.status(500).json({ error: 'Server Error', message: '수신자 수 조회에 실패했습니다.' });
        }
    });

    router.get('/logs', verifyToken, checkPermission('sms', 'view'), async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const [countResult] = await db.query(
                `SELECT COUNT(*) AS total FROM notification_logs
                 WHERE academy_id = ? AND message_type IN ('sms', 'lms', 'mms')`,
                [req.user.academyId]
            );
            const [logs] = await db.query(
                `SELECT * FROM notification_logs
                 WHERE academy_id = ? AND message_type IN ('sms', 'lms', 'mms')
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?`,
                [req.user.academyId, parseInt(limit), offset]
            );

            res.json({
                logs,
                pagination: {
                    total: countResult[0].total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(countResult[0].total / limit)
                }
            });
        } catch (error) {
            logger.error('SMS 로그 조회 오류:', error);
            res.status(500).json({ error: 'Server Error', message: 'SMS 발송 내역 조회에 실패했습니다.' });
        }
    });

    router.get('/sender-numbers', verifyToken, async (req, res) => {
        try {
            const { serviceType } = req.query;
            let query = `
                SELECT id, service_type, phone, label, is_default, created_at
                FROM sender_numbers
                WHERE academy_id = ?
            `;
            const params = [req.user.academyId];

            if (serviceType) {
                query += ' AND service_type = ?';
                params.push(serviceType);
            }
            query += ' ORDER BY is_default DESC, created_at ASC';

            const [senderNumbers] = await db.query(query, params);
            res.json({ senderNumbers });
        } catch (error) {
            logger.error('발신번호 목록 조회 오류:', error);
            res.status(500).json({ error: 'Server Error', message: '발신번호 목록 조회에 실패했습니다.' });
        }
    });

    router.post('/sender-numbers', verifyToken, checkPermission('sms', 'edit'), async (req, res) => {
        try {
            const { serviceType, phone, label } = req.body;
            if (!serviceType || !phone) {
                return res.status(400).json({ error: 'Validation Error', message: '서비스 타입과 발신번호는 필수입니다.' });
            }
            if (!isValidPhoneNumber(phone)) {
                return res.status(400).json({ error: 'Validation Error', message: '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)' });
            }

            const [existing] = await db.query(
                `SELECT id FROM sender_numbers
                 WHERE academy_id = ? AND service_type = ? AND phone = ?`,
                [req.user.academyId, serviceType, phone]
            );
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Duplicate Error', message: '이미 등록된 발신번호입니다.' });
            }

            const [count] = await db.query(
                `SELECT COUNT(*) as cnt FROM sender_numbers
                 WHERE academy_id = ? AND service_type = ?`,
                [req.user.academyId, serviceType]
            );
            const isDefault = count[0].cnt === 0 ? 1 : 0;

            const [result] = await db.query(
                `INSERT INTO sender_numbers (academy_id, service_type, phone, label, is_default)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.user.academyId, serviceType, phone, label || null, isDefault]
            );

            res.json({
                message: '발신번호가 추가되었습니다.',
                senderNumber: { id: result.insertId, service_type: serviceType, phone, label, is_default: isDefault }
            });
        } catch (error) {
            logger.error('발신번호 추가 오류:', error);
            res.status(500).json({ error: 'Server Error', message: '발신번호 추가에 실패했습니다.' });
        }
    });

    router.put('/sender-numbers/:id', verifyToken, checkPermission('sms', 'edit'), async (req, res) => {
        try {
            const { id } = req.params;
            const { label, isDefault } = req.body;
            const [existing] = await db.query(
                `SELECT * FROM sender_numbers WHERE id = ? AND academy_id = ?`,
                [id, req.user.academyId]
            );
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Not Found', message: '발신번호를 찾을 수 없습니다.' });
            }

            const updates = [];
            const params = [];
            if (label !== undefined) {
                updates.push('label = ?');
                params.push(label);
            }

            if (isDefault !== undefined && isDefault) {
                await db.query(
                    `UPDATE sender_numbers SET is_default = 0
                     WHERE academy_id = ? AND service_type = ?`,
                    [req.user.academyId, existing[0].service_type]
                );
                updates.push('is_default = 1');
            }

            if (updates.length > 0) {
                params.push(id, req.user.academyId);
                await db.query(
                    `UPDATE sender_numbers SET ${updates.join(', ')} WHERE id = ? AND academy_id = ?`,
                    params
                );
            }

            res.json({ message: '발신번호가 수정되었습니다.' });
        } catch (error) {
            logger.error('발신번호 수정 오류:', error);
            res.status(500).json({ error: 'Server Error', message: '발신번호 수정에 실패했습니다.' });
        }
    });

    router.delete('/sender-numbers/:id', verifyToken, checkPermission('sms', 'edit'), async (req, res) => {
        try {
            const { id } = req.params;
            const [existing] = await db.query(
                `SELECT * FROM sender_numbers WHERE id = ? AND academy_id = ?`,
                [id, req.user.academyId]
            );
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Not Found', message: '발신번호를 찾을 수 없습니다.' });
            }

            await db.query('DELETE FROM sender_numbers WHERE id = ? AND academy_id = ?', [id, req.user.academyId]);

            if (existing[0].is_default) {
                await db.query(
                    `UPDATE sender_numbers SET is_default = 1
                     WHERE academy_id = ? AND service_type = ?
                     ORDER BY created_at ASC LIMIT 1`,
                    [req.user.academyId, existing[0].service_type]
                );
            }

            res.json({ message: '발신번호가 삭제되었습니다.' });
        } catch (error) {
            logger.error('발신번호 삭제 오류:', error);
            res.status(500).json({ error: 'Server Error', message: '발신번호 삭제에 실패했습니다.' });
        }
    });
}

module.exports = registerSmsAuxiliaryRoutes;
