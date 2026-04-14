/**
 * Authentication Routes
 * /api/auth
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { generateToken, verifyToken } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/emailSender');
const { encrypt, decrypt, decryptFields, ENCRYPTED_FIELDS } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const {
            email,
            password,
            name,
            phone,
            role = 'owner', // 첫 가입자는 원장으로 등록
            academyName // 원장이 가입할 때 학원명
        } = req.body;

        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Email, password, and name are required'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid email format'
            });
        }

        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Password must be at least 8 characters'
            });
        }

        await connection.beginTransaction();

        // Check if email already exists
        const [existingUsers] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                error: 'Conflict',
                message: 'Email already registered'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // 민감 필드 암호화
        const encryptedName = encrypt(name);
        const encryptedPhone = phone ? encrypt(phone) : null;

        // Insert user (원장으로 등록, 승인 대기 상태)
        const [userResult] = await connection.query(
            `INSERT INTO users
            (email, password_hash, name, phone, role, approval_status, is_active)
            VALUES (?, ?, ?, ?, ?, 'pending', TRUE)`,
            [email, passwordHash, encryptedName, encryptedPhone, role]
        );

        const userId = userResult.insertId;

        // 원장인 경우 학원 정보도 생성
        if (role === 'owner' && academyName) {
            const [academyResult] = await connection.query(
                'INSERT INTO academies (owner_user_id, name) VALUES (?, ?)',
                [userId, academyName]
            );

            const academyId = academyResult.insertId;

            // Update user's academy_id
            await connection.query(
                'UPDATE users SET academy_id = ? WHERE id = ?',
                [academyId, userId]
            );

            // Create default academy settings
            await connection.query(
                'INSERT INTO academy_settings (academy_id) VALUES (?)',
                [academyId]
            );
        }

        await connection.commit();

        res.status(201).json({
            message: 'Registration successful. Please wait for administrator approval.',
            user: {
                id: userId,
                email,
                name,
                role,
                approvalStatus: 'pending'
            }
        });

    } catch (error) {
        await connection.rollback();
        logger.error('Registration error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Registration failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Email and password are required'
            });
        }

        // Find user
        const [users] = await db.query(
            `SELECT id, email, password_hash, name, role, academy_id,
             approval_status, is_active, position, permissions
             FROM users
             WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '이메일 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        const user = users[0];

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '이메일 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '비활성화된 계정입니다.'
            });
        }

        // Check if account is approved
        if (user.approval_status !== 'approved') {
            return res.status(403).json({
                error: 'Forbidden',
                message: '승인 대기 중인 계정입니다. 관리자에게 문의해주세요.',
                approvalStatus: user.approval_status
            });
        }

        // Update last login
        await db.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = ?',
            [user.id]
        );

        // Generate token
        const token = generateToken(user.id);

        // Get academy info if exists
        let academy = null;
        if (user.academy_id) {
            const [academies] = await db.query(
                'SELECT id, name FROM academies WHERE id = ?',
                [user.academy_id]
            );
            academy = academies[0] || null;
        }

        // Parse permissions JSON
        let permissions = {};
        if (user.permissions) {
            try {
                permissions = typeof user.permissions === 'string'
                    ? JSON.parse(user.permissions)
                    : user.permissions;
            } catch (e) {
                logger.error('Failed to parse permissions:', e);
            }
        }

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: decrypt(user.name),  // 복호화
                role: user.role,
                academyId: user.academy_id,
                academy,
                position: user.position,
                permissions: permissions
            }
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Login failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', verifyToken, async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT u.id, u.email, u.name, u.phone, u.role, u.academy_id,
             a.name as academy_name
             FROM users u
             LEFT JOIN academies a ON u.academy_id = a.id
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        // 민감 필드 복호화
        const decryptedUser = decryptFields(users[0], ENCRYPTED_FIELDS.users);

        res.json({
            user: decryptedUser
        });

    } catch (error) {
        logger.error('Get user error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get user info'
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'New password must be at least 8 characters'
            });
        }

        // Get current password hash
        const [users] = await db.query(
            'SELECT password_hash FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);

        if (!isValid) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.query(
            'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
            [newPasswordHash, req.user.id]
        );

        res.json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        logger.error('Change password error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to change password'
        });
    }
});

/**
 * POST /paca/auth/verify-password
 * 비밀번호 확인 (급여 지급 등 중요 작업 전 확인용)
 */
router.post('/verify-password', verifyToken, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '비밀번호를 입력해주세요'
            });
        }

        // 현재 로그인한 사용자의 비밀번호 해시 조회
        const [users] = await db.query(
            'SELECT password_hash FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '사용자를 찾을 수 없습니다'
            });
        }

        // 비밀번호 확인
        const isValid = await bcrypt.compare(password, users[0].password_hash);

        if (!isValid) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '비밀번호가 일치하지 않습니다'
            });
        }

        res.json({
            message: '비밀번호가 확인되었습니다',
            verified: true
        });

    } catch (error) {
        logger.error('Verify password error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: '비밀번호 확인에 실패했습니다'
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * 비밀번호 찾기 - 리셋 링크 이메일 발송
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '이메일을 입력해주세요'
            });
        }

        // 사용자 확인
        const [users] = await db.query(
            'SELECT id, name, email FROM users WHERE email = ? AND deleted_at IS NULL',
            [email]
        );

        // 보안상 이메일 존재 여부와 관계없이 같은 응답 반환
        if (users.length === 0) {
            return res.json({
                message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 메일함을 확인해주세요.'
            });
        }

        const user = users[0];

        // 리셋 토큰 생성 (32바이트 = 64자 hex)
        const resetToken = crypto.randomBytes(32).toString('hex');

        // 토큰 해시 (DB에는 해시값 저장)
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // 만료 시간 설정 (1시간)
        const expires = new Date(Date.now() + 60 * 60 * 1000);

        // DB에 토큰 저장
        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [resetTokenHash, expires, user.id]
        );

        // 리셋 URL 생성 (프론트엔드 URL)
        const resetUrl = process.env.FRONTEND_URL || 'https://pacapro.vercel.app';
        const fullResetUrl = `${resetUrl}/reset-password`;

        // 이메일 발송
        await sendPasswordResetEmail(user.email, user.name, resetToken, fullResetUrl);

        res.json({
            message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 메일함을 확인해주세요.'
        });

    } catch (error) {
        logger.error('Forgot password error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: '비밀번호 재설정 이메일 발송에 실패했습니다'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * 비밀번호 재설정
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '토큰과 새 비밀번호를 입력해주세요'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '비밀번호는 8자 이상이어야 합니다'
            });
        }

        // 토큰 해시
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // 토큰으로 사용자 찾기 (만료 시간 체크)
        const [users] = await db.query(
            `SELECT id, email FROM users
             WHERE reset_token = ?
             AND reset_token_expires > NOW()
             AND deleted_at IS NULL`,
            [tokenHash]
        );

        if (users.length === 0) {
            return res.status(400).json({
                error: 'Invalid Token',
                message: '유효하지 않거나 만료된 링크입니다. 비밀번호 찾기를 다시 시도해주세요.'
            });
        }

        const user = users[0];

        // 새 비밀번호 해시
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // 비밀번호 업데이트 및 토큰 삭제
        await db.query(
            `UPDATE users
             SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
             WHERE id = ?`,
            [passwordHash, user.id]
        );

        res.json({
            message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.'
        });

    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: '비밀번호 재설정에 실패했습니다'
        });
    }
});

/**
 * GET /api/auth/verify-reset-token
 * 리셋 토큰 유효성 확인
 */
router.get('/verify-reset-token', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '토큰이 필요합니다',
                valid: false
            });
        }

        // 토큰 해시
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // 토큰 유효성 확인
        const [users] = await db.query(
            `SELECT id FROM users
             WHERE reset_token = ?
             AND reset_token_expires > NOW()
             AND deleted_at IS NULL`,
            [tokenHash]
        );

        if (users.length === 0) {
            return res.json({
                valid: false,
                message: '유효하지 않거나 만료된 링크입니다'
            });
        }

        res.json({
            valid: true,
            message: '유효한 토큰입니다'
        });

    } catch (error) {
        logger.error('Verify reset token error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: '토큰 확인에 실패했습니다',
            valid: false
        });
    }
});

module.exports = router;
