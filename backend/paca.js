/**
 * P-ACA 체대입시 학원관리시스템 Backend Server
 * Port: 8320
 * Database: MySQL (paca)
 */

require('dotenv').config();

// 환경변수 검증 (서버 시작 전 필수!)
const { validateEnv } = require('./utils/env-validator');
if (!validateEnv()) {
    console.error('[PACA] 환경변수 검증 실패. 서버를 시작할 수 없습니다.');
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8320;

// Trust proxy - nginx 리버스 프록시 뒤에서 실행될 때 필요
app.set('trust proxy', 1);

// ==========================================
// Middleware Configuration
// ==========================================

// CORS Configuration (MUST be before helmet!)
// 개발 환경: 모든 도메인 허용 / 프로덕션: 화이트리스트 적용
const isDev = process.env.NODE_ENV === 'development';

const ALLOWED_ORIGINS = [
    'https://pacapro.vercel.app',
    'https://chejump.com',
    'https://dev.sean8320.dedyn.io',
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.CORS_ORIGIN // 추가 도메인 (환경변수)
].filter(Boolean);

const corsOptions = {
    origin: isDev ? '*' : (origin, callback) => {
        // 서버-서버 요청 (origin 없음) 또는 화이트리스트
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] 차단된 origin: ${origin}`);
            callback(null, false); // 에러 대신 false 반환 (연결 거부)
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// 프리플라이트 확실히 처리하고 싶으면 한 줄 더
app.options('*', cors(corsOptions));


// Security Headers (configured to not interfere with CORS)
app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate Limiting - 공개 API에만 적용 (내부 API는 제외)
// 공개 API: 15분에 30회 (상담 신청, 학원 정보 조회 등)
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too Many Requests',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
    },
    skip: (req) => isDev // 개발 환경에서는 스킵
});

// 로그인 API: 15분에 10회 (브루트포스 방지)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too Many Requests',
        message: '로그인 시도 횟수가 초과되었습니다. 15분 후 다시 시도해주세요.'
    },
    skip: (req) => isDev
});

// 레이트 리미팅 적용
app.use('/paca/public', publicLimiter);
app.use('/paca/auth/login', loginLimiter);

// ==========================================
// Database Connection
// ==========================================
const db = require('./config/database');

// Test database connection
db.getConnection()
    .then(connection => {
        console.log('✅ MySQL Database Connected Successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ MySQL Connection Error:', err.message);
        process.exit(1);
    });

// ==========================================
// Routes
// ==========================================

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Base Route
app.get('/paca', (req, res) => {
    res.json({
        message: 'P-ACA API Server',
        version: '1.0.0',
        endpoints: {
            auth: '/paca/auth',
            users: '/paca/users',
            students: '/paca/students',
            instructors: '/paca/instructors',
            payments: '/paca/payments',
            salaries: '/paca/salaries',
            seasons: '/paca/seasons',
            schedules: '/paca/schedules',
            settings: '/paca/settings',
            performance: '/paca/performance',
            expenses: '/paca/expenses',
            incomes: '/paca/incomes',
            reports: '/paca/reports',
            staff: '/paca/staff',
            notifications: '/paca/notifications'
        }
    });
});

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const instructorRoutes = require('./routes/instructors');
const paymentRoutes = require('./routes/payments');
const salaryRoutes = require('./routes/salaries');
const seasonRoutes = require('./routes/seasons');
const scheduleRoutes = require('./routes/schedules');
const settingRoutes = require('./routes/settings');
const performanceRoutes = require('./routes/performance');
const expenseRoutes = require('./routes/expenses');
const incomeRoutes = require('./routes/incomes');
const reportRoutes = require('./routes/reports');
const exportRoutes = require('./routes/exports');
const staffRoutes = require('./routes/staff');
const onboardingRoutes = require('./routes/onboarding');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const smsRoutes = require('./routes/sms');
const publicRoutes = require('./routes/public');
const consultationRoutes = require('./routes/consultations');
const pushRoutes = require('./routes/push');
const notificationSettingsRoutes = require('./routes/notificationSettings');
const tossRoutes = require('./routes/toss');
const studentConsultationRoutes = require('./routes/student-consultations');

// Register Routes
app.use('/paca/auth', authRoutes);
app.use('/paca/users', userRoutes);
app.use('/paca/students', studentRoutes);
app.use('/paca/instructors', instructorRoutes);
app.use('/paca/payments', paymentRoutes);
app.use('/paca/salaries', salaryRoutes);
app.use('/paca/seasons', seasonRoutes);
app.use('/paca/schedules', scheduleRoutes);
app.use('/paca/settings', settingRoutes);
app.use('/paca/performance', performanceRoutes);
app.use('/paca/expenses', expenseRoutes);
app.use('/paca/incomes', incomeRoutes);
app.use('/paca/reports', reportRoutes);
app.use('/paca/exports', exportRoutes);
app.use('/paca/staff', staffRoutes);
app.use('/paca/onboarding', onboardingRoutes);
app.use('/paca/search', searchRoutes);
app.use('/paca/notifications', notificationRoutes);
app.use('/paca/sms', smsRoutes);
app.use('/paca/public', publicRoutes);
app.use('/paca/consultations', consultationRoutes);
app.use('/paca/push', pushRoutes);
app.use('/paca/notification-settings', notificationSettingsRoutes);
app.use('/paca/toss', tossRoutes);
app.use('/paca/student-consultations', studentConsultationRoutes);

// ==========================================
// Error Handling
// ==========================================

// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        path: req.originalUrl
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // JWT Authentication Error
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token'
        });
    }

    // Validation Error
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message,
            details: err.details
        });
    }

    // Database Error
    if (err.code && err.code.startsWith('ER_')) {
        return res.status(500).json({
            error: 'Database Error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
            code: err.code
        });
    }

    // Default Error
    res.status(err.status || 500).json({
        error: err.name || 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ==========================================
// Scheduler
// ==========================================
const { initScheduler } = require('./scheduler/paymentScheduler');
const { initNotificationScheduler } = require('./scheduler/notificationScheduler');
const { initGradePromotionScheduler } = require('./scheduler/gradePromotionScheduler');
const { initScheduler: initExcusedCreditScheduler } = require('./scheduler/excusedCreditScheduler');
const { initPushScheduler } = require('./scheduler/pushScheduler');
const { initConsultationReminderScheduler } = require('./scheduler/consultationReminderScheduler');
const { initPauseEndingScheduler } = require('./scheduler/pauseEndingScheduler');
const { initTrialExpireScheduler } = require('./scheduler/trialExpireScheduler');
const { initMonthlyScheduleScheduler } = require('./scheduler/monthlyScheduleScheduler');

// ==========================================
// Start Server
// ==========================================
const server = app.listen(PORT, () => {
    console.log('==========================================');
    console.log('🏋️  P-ACA Backend Server');
    console.log('==========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    console.log(`🌐 API Base: http://localhost:${PORT}/paca`);
    console.log('==========================================');

    // 스케줄러 초기화
    initScheduler();
    initNotificationScheduler();
    initGradePromotionScheduler();
    initExcusedCreditScheduler();
    initPushScheduler();
    initConsultationReminderScheduler();
    initPauseEndingScheduler();
    initTrialExpireScheduler();
    initMonthlyScheduleScheduler();
});

// Graceful Shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[${signal}] Graceful shutdown 시작...`);

    // 새 요청 거부
    server.close(() => {
        console.log('[SHUTDOWN] HTTP 서버 종료 완료');
    });

    // 진행 중인 요청 완료 대기 (최대 30초)
    const shutdownTimeout = setTimeout(() => {
        console.error('[SHUTDOWN] 타임아웃 - 강제 종료');
        process.exit(1);
    }, 30000);

    try {
        // DB 연결 풀 종료
        await db.end();
        console.log('[SHUTDOWN] DB 연결 풀 종료 완료');

        clearTimeout(shutdownTimeout);
        console.log('[SHUTDOWN] 정상 종료');
        process.exit(0);
    } catch (err) {
        console.error('[SHUTDOWN] 종료 중 에러:', err.message);
        clearTimeout(shutdownTimeout);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
