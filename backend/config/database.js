/**
 * MySQL Database Connection Configuration
 */

const mysql = require('mysql2/promise');

// 환경변수에서 DB 설정 가져오기
// 주의: DB_PASSWORD는 env-validator.js에서 검증됨 (개발환경 기본값 설정됨)
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'paca';
const DB_PASSWORD = process.env.DB_PASSWORD; // 기본값 제거! (env-validator에서 처리)
const DB_NAME = process.env.DB_NAME || 'paca';

// Create MySQL connection pool
const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 10,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 50,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000, // 연결 타임아웃 10초
    timezone: '+09:00', // 한국 시간
    dateStrings: true // DATE 타입을 문자열로 반환
});

/**
 * DB 연결 테스트 (재시도 로직 포함)
 */
async function testConnection(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const connection = await pool.getConnection();
            await connection.query("SET time_zone = '+09:00'");
            connection.release();
            console.log(`[DB] ✅ MySQL 연결 성공 (시도 ${attempt}/${maxRetries})`);
            return true;
        } catch (err) {
            console.error(`[DB] ❌ MySQL 연결 실패 (시도 ${attempt}/${maxRetries}):`, err.message);
            if (attempt < maxRetries) {
                console.log(`[DB] ⏳ 5초 후 재시도...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
    console.error('[DB] ❌ 모든 연결 시도 실패. 서버를 종료합니다.');
    process.exit(1);
}

// 서버 시작 시 연결 테스트
testConnection();

// 모든 연결에 타임존 설정 적용
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+09:00'");
});

module.exports = pool;
