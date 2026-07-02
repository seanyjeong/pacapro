const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { notifySignupApprovalRequest } = require('../../services/adminSignupNotifier');
const { encrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegisterRequest({ email, password, name, academyName }) {
    if (!email || !password || !name) {
        return { status: 400, error: 'Validation Error', message: 'Email, password, and name are required' };
    }

    if (!EMAIL_REGEX.test(email)) {
        return { status: 400, error: 'Validation Error', message: 'Invalid email format' };
    }

    if (password.length < 8) {
        return { status: 400, error: 'Validation Error', message: 'Password must be at least 8 characters' };
    }

    if (!academyName || !String(academyName).trim()) {
        return { status: 400, error: 'Validation Error', message: '학원명을 입력해주세요.' };
    }

    return null;
}

function sendSignupNotification(payload) {
    notifySignupApprovalRequest(payload).catch(() => {
        logger.warn('[SignupApproval] Notification dispatch failed');
    });
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
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                error: 'Conflict',
                message: 'Email already registered',
            });
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
            error: 'Internal Server Error',
            message: 'Registration failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = registerHandler;
