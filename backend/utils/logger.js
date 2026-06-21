const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 로그 디렉토리 설정
const logDir = path.join(__dirname, '../logs');

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// 콘솔 출력 포맷 (개발환경용 - 컬러)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `[${timestamp}] ${level}: ${message}\n${stack}`;
    }
    return `[${timestamp}] ${level}: ${message}`;
  })
);

// Transport 설정
const transports = [];

// 프로덕션 환경: 파일 로그
if (process.env.NODE_ENV === 'production') {
  // 에러 로그 (일별 로테이션)
  transports.push(
    new DailyRotateFile({
      level: 'error',
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // 30일 보관
      format: logFormat,
    })
  );

  // 모든 로그 (일별 로테이션)
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d', // 14일 보관
      format: logFormat,
    })
  );
} else {
  // 개발 환경: 콘솔 출력
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Logger 인스턴스 생성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
  exitOnError: false,
});

// 개발 환경에서도 파일 로그를 원하는 경우 (옵션)
if (process.env.NODE_ENV !== 'production' && process.env.FILE_LOGGING === 'true') {
  logger.add(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'dev-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      format: logFormat,
    })
  );
}

module.exports = logger;
