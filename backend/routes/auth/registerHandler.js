const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { notifySignupApprovalRequest } = require('../../services/adminSignupNotifier');
const { encrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegisterRequest({ email, password, name, academyName }) {
    if (!email || !password || !name) {
        return { status: 400, error: '입력값 오류', message: '이메일, 비밀번호, 이름을 모두 입력해주세요.' };
    }

    if (!EMAIL_REGEX.test(email)) {
        return { status: 400, error: '입력값 오류', message: '올바른 이메일 주소를 입력해주세요.' };
    }

    if (password.length < 8) {
        return { status: 400, error: '입력값 오류', message: '비밀번호는 8자 이상이어야 합니다.' };
    }

    if (!academyName || !String(academyName).trim()) {
        return { status: 400, error: '입력값 오류', message: '학원명을 입력해주세요.' };
    }

    return null;
}

function sendSignupNotification(payload) {
    notifySignupApprovalRequest(payload).catch(() => {
        logger.warn('[SignupApproval] Notification dispatch failed');
    });
}

async function clearRejectedSignupUsers(connection, existingUsers) {
    const rejectedUserIds = existingUsers
        .filter((user) => user.approval_status === 'rejected')
        .map((user) => user.id);

    if (rejectedUserIds.length === 0) return;

    await connection.query(
        "DELETE FROM users WHERE id IN (?) AND approval_status = ?",
        [rejectedUserIds, 'rejected']
    );
}

async function registerHandler(req, res) {
    const {
        academyName,
        email,
        name,
        password,
        phone,
    } = req.body;
    const validationError = validateRegisterRequest({ academyName, email, name, password });

    if (validationError) {
        return res.status(validationError.status).json({
            error: validationError.error,
            message: validationError.message,
        });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existingUsers] = await connection.query(
            'SELECT id, approval_status FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            const hasBlockingUser = existingUsers.some((user) => user.approval_status !== 'rejected');
            if (hasBlockingUser) {
                await connection.rollback();
                return res.status(409).json({
                    error: '중복 이메일',
                    message: '이미 등록된 이메일입니다.',
                });
            }

            await clearRejectedSignupUsers(connection, existingUsers);
        }

        const role = 'owner';
        const passwordHash = await bcrypt.hash(password, 10);
        const encryptedName = encrypt(name);
        const encryptedPhone = phone ? encrypt(phone) : null;

        const [userResult] = await connection.query(
            `INSERT INTO users
            (email, password_hash, name, phone, role, approval_status, is_active)
            VALUES (?, ?, ?, ?, ?, 'pending', TRUE)`,
            [email, passwordHash, encryptedName, encryptedPhone, role]
        );

        const userId = userResult.insertId;
        const [academyResult] = await connection.query(
            'INSERT INTO academies (owner_user_id, name) VALUES (?, ?)',
            [userId, academyName]
        );
        const academyId = academyResult.insertId;

        await connection.query(
            'UPDATE users SET academy_id = ? WHERE id = ?',
            [academyId, userId]
        );

        await connection.query(
            'INSERT INTO academy_settings (academy_id) VALUES (?)',
            [academyId]
        );

        await connection.commit();

        sendSignupNotification({
            academyId,
            academyName,
            email,
            name,
            phone,
            userId,
        });

        return res.status(201).json({
            message: 'Registration successful. Please wait for administrator approval.',
            user: {
                id: userId,
                email,
                name,
                role,
                approvalStatus: 'pending',
            },
        });
    } catch (error) {
        if (connection) await connection.rollback();
        logger.error('Registration error:', error);
        return res.status(500).json({
            error: '서버 오류',
            message: '회원가입을 완료하지 못했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = registerHandler;
