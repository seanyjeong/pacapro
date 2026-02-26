/**
 * User Service
 * 사용자 관리 비즈니스 로직
 */

const db = require('../config/database');
const { decrypt } = require('../utils/encryption');

function decryptUserFields(obj) {
    if (!obj) return obj;
    if (obj.name) obj.name = decrypt(obj.name);
    if (obj.phone) obj.phone = decrypt(obj.phone);
    return obj;
}

function decryptArray(arr) {
    return arr.map(item => decryptUserFields({...item}));
}

/**
 * 승인 대기 사용자 목록 조회
 */
async function getPendingUsers(academyId) {
    const [users] = await db.query(
        `SELECT
            u.id, u.email, u.name, u.phone, u.role,
            u.approval_status, u.created_at,
            a.name as academy_name
        FROM users u
        LEFT JOIN academies a ON u.academy_id = a.id
        WHERE u.approval_status = 'pending'
        AND u.is_active = true
        AND u.academy_id = ?
        ORDER BY u.created_at DESC`,
        [academyId]
    );

    return { message: `Found ${users.length} pending users`, users: decryptArray(users) };
}

/**
 * 사용자 승인/거절 공통 로직
 */
async function changeApprovalStatus(userId, academyId, newStatus) {
    const [users] = await db.query(
        'SELECT id, email, name, approval_status, academy_id FROM users WHERE id = ? AND academy_id = ?',
        [userId, academyId]
    );

    if (users.length === 0) {
        return { status: 404, error: 'Not Found', message: 'User not found' };
    }

    const user = users[0];

    if (user.approval_status !== 'pending') {
        return { status: 400, error: 'Bad Request', message: `User is already ${user.approval_status}` };
    }

    await db.query(
        'UPDATE users SET approval_status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, userId]
    );

    return {
        status: 200,
        message: `User ${newStatus} successfully`,
        user: { id: user.id, email: user.email, name: decrypt(user.name), approval_status: newStatus }
    };
}

/**
 * 전체 사용자 목록 조회 (필터 지원)
 */
async function getUsers(academyId, filters) {
    const { role, approval_status } = filters;

    let query = `
        SELECT
            u.id, u.email, u.name, u.phone, u.role,
            u.approval_status, u.is_active, u.created_at,
            a.name as academy_name
        FROM users u
        LEFT JOIN academies a ON u.academy_id = a.id
        WHERE u.academy_id = ?
    `;
    const params = [academyId];

    if (role) {
        query += ' AND u.role = ?';
        params.push(role);
    }
    if (approval_status) {
        query += ' AND u.approval_status = ?';
        params.push(approval_status);
    }
    query += ' ORDER BY u.created_at DESC';

    const [users] = await db.query(query, params);
    return { message: `Found ${users.length} users`, users: decryptArray(users) };
}

/**
 * 사용자 상세 조회
 */
async function getUserById(userId, academyId) {
    const [users] = await db.query(
        `SELECT
            u.id, u.email, u.name, u.phone, u.role,
            u.approval_status, u.is_active, u.created_at, u.updated_at, u.last_login,
            a.id as academy_id, a.name as academy_name
        FROM users u
        LEFT JOIN academies a ON u.academy_id = a.id
        WHERE u.id = ? AND u.academy_id = ?`,
        [userId, academyId]
    );

    if (users.length === 0) {
        return null;
    }

    return decryptUserFields({...users[0]});
}

module.exports = { getPendingUsers, changeApprovalStatus, getUsers, getUserById };
