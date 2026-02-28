/**
 * Audit Logger Utility
 * 변경 이력을 audit_logs 테이블에 기록
 * fire-and-forget 패턴 (실패해도 메인 로직 안 멈춤)
 */

const db = require('../config/database');
const logger = require('./logger');

/**
 * @param {Object} params
 * @param {number} params.userId
 * @param {string} params.userEmail
 * @param {string} params.userRole
 * @param {string} params.action - 'update', 'create', 'delete', 'schedule'
 * @param {string} params.tableName - 'students', 'payments', etc.
 * @param {number} params.recordId
 * @param {Object} params.oldValues - 변경 전 값
 * @param {Object} params.newValues - 변경 후 값
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 */
async function logAudit({ userId, userEmail, userRole, action, tableName, recordId, oldValues, newValues, ipAddress, userAgent }) {
    try {
        await db.query(
            `INSERT INTO audit_logs (user_id, user_email, user_role, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                userEmail || null,
                userRole || null,
                action,
                tableName,
                recordId,
                JSON.stringify(oldValues),
                JSON.stringify(newValues),
                ipAddress || null,
                userAgent || null
            ]
        );
    } catch (error) {
        logger.error('[AuditLog] Failed to write audit log:', error);
    }
}

/**
 * Express req에서 audit 정보 추출 헬퍼
 */
function getAuditInfoFromReq(req) {
    return {
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
    };
}

module.exports = { logAudit, getAuditInfoFromReq };
