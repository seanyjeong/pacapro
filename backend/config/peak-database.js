/**
 * P-EAK Database Connection Configuration
 * P-EAK (Physical Excellence Achievement Keeper) - 실기 훈련관리 시스템
 */

const mysql = require('mysql2/promise');

// P-EAK DB는 동일 서버의 다른 데이터베이스
const DB_HOST = process.env.PEAK_DB_HOST || process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.PEAK_DB_PORT || process.env.DB_PORT) || 3306;
const DB_USER = process.env.PEAK_DB_USER || process.env.DB_USER || 'paca';
const DB_PASSWORD = process.env.PEAK_DB_PASSWORD || process.env.DB_PASSWORD;
const DB_NAME = process.env.PEAK_DB_NAME || 'peak';

// Create MySQL connection pool for P-EAK
const peakPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // P-EAK 연결은 적게 유지
    queueLimit: 50,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000,
    timezone: '+09:00',
    dateStrings: true
});

/**
 * P-EAK DB 연결 테스트
 */
async function testPeakConnection() {
    try {
        const connection = await peakPool.getConnection();
        await connection.query("SET time_zone = '+09:00'");
        connection.release();
        console.log('[P-EAK DB] ✅ 연결 성공');
        return true;
    } catch (err) {
        // P-EAK DB 연결 실패는 치명적이지 않음 (선택적 기능)
        console.warn('[P-EAK DB] ⚠️ 연결 실패 (실기 기록 연동 불가):', err.message);
        return false;
    }
}

// 서버 시작 시 연결 테스트 (실패해도 계속 진행)
testPeakConnection();

// 타임존 설정
peakPool.on('connection', (connection) => {
    connection.query("SET time_zone = '+09:00'");
});

module.exports = peakPool;
