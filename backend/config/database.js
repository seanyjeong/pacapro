/**
 * MySQL Database Connection Configuration
 */

const mysql = require('mysql2/promise');

// Create MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'paca',
    password: process.env.DB_PASSWORD || 'q141171616!',
    database: process.env.DB_NAME || 'paca',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+09:00', // 한국 시간
    dateStrings: true // DATE 타입을 문자열로 반환
});

// Test connection on startup and set timezone
pool.getConnection()
    .then(async connection => {
        // MySQL 세션 타임존을 한국 시간으로 설정
        await connection.query("SET time_zone = '+09:00'");
        connection.release();
    })
    .catch(err => {
        // DB 연결 실패 시 프로세스 종료
        process.exit(1);
    });

// 모든 연결에 타임존 설정 적용
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+09:00'");
});

module.exports = pool;
