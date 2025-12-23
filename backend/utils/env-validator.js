/**
 * 환경변수 검증 유틸리티
 * 서버 시작 전 필수 환경변수 존재 여부 확인
 */

// 프로덕션 필수 환경변수
const REQUIRED_ENV = {
    // 데이터베이스
    DB_PASSWORD: '데이터베이스 비밀번호',

    // 보안
    DATA_ENCRYPTION_KEY: '데이터 암호화 키 (32자)',
    JWT_SECRET: 'JWT 서명 키',

    // 외부 서비스
    N8N_API_KEY: 'N8N API 키'
};

// 선택적 환경변수 (기본값 있음)
const OPTIONAL_ENV = {
    DB_HOST: { default: 'localhost', desc: '데이터베이스 호스트' },
    DB_PORT: { default: '3306', desc: '데이터베이스 포트' },
    DB_USER: { default: 'paca', desc: '데이터베이스 사용자' },
    DB_NAME: { default: 'paca', desc: '데이터베이스 이름' },
    PORT: { default: '8320', desc: '서버 포트' },
    NODE_ENV: { default: 'development', desc: '실행 환경' }
};

// 개발 환경 기본값 (프로덕션에서는 사용 불가!)
const DEV_DEFAULTS = {
    DB_PASSWORD: 'q141171616!',
    DATA_ENCRYPTION_KEY: 'paca-default-encryption-key-32b!',
    JWT_SECRET: 'jeong-paca-secret-dev-only',
    N8N_API_KEY: 'paca-n8n-api-key-2024-dev'
};

/**
 * 환경변수 검증
 * @returns {boolean} 검증 성공 여부
 */
function validateEnv() {
    const isDev = process.env.NODE_ENV === 'development';
    const missing = [];
    const warnings = [];

    console.log('==========================================');
    console.log('[ENV] 환경변수 검증 시작...');
    console.log(`[ENV] 환경: ${isDev ? 'development' : 'production'}`);
    console.log('==========================================');

    // 필수 환경변수 확인
    for (const [key, desc] of Object.entries(REQUIRED_ENV)) {
        if (!process.env[key]) {
            if (isDev) {
                // 개발 환경: 기본값 설정 + 경고
                process.env[key] = DEV_DEFAULTS[key];
                warnings.push(`${key}: ${desc} (개발 기본값 사용)`);
            } else {
                // 프로덕션: 에러
                missing.push(`${key}: ${desc}`);
            }
        }
    }

    // 선택적 환경변수 기본값 설정
    for (const [key, { default: defaultVal }] of Object.entries(OPTIONAL_ENV)) {
        if (!process.env[key]) {
            process.env[key] = defaultVal;
        }
    }

    // 경고 출력
    if (warnings.length > 0) {
        console.warn('[ENV] ⚠️  개발 환경 기본값 사용 중:');
        warnings.forEach(w => console.warn(`  - ${w}`));
        console.warn('[ENV] ⚠️  프로덕션 배포 전 반드시 환경변수 설정 필요!');
    }

    // 에러 출력 및 종료
    if (missing.length > 0) {
        console.error('[ENV] ❌ 필수 환경변수 누락:');
        missing.forEach(m => console.error(`  - ${m}`));
        console.error('[ENV] ❌ 서버를 시작할 수 없습니다.');
        console.error('[ENV] .env 파일을 확인하거나 .env.example을 참고하세요.');
        return false;
    }

    console.log('[ENV] ✅ 환경변수 검증 완료');
    return true;
}

/**
 * 환경변수 안전하게 가져오기
 * @param {string} key - 환경변수 키
 * @param {string} fallback - 개발 환경 기본값 (프로덕션에서는 무시)
 * @returns {string} 환경변수 값
 */
function getEnv(key, fallback = null) {
    const value = process.env[key];

    if (value) {
        return value;
    }

    if (process.env.NODE_ENV === 'development' && fallback) {
        console.warn(`[ENV] ${key} 미설정 - 개발 기본값 사용`);
        return fallback;
    }

    return null;
}

/**
 * 필수 환경변수 가져오기 (없으면 예외)
 * @param {string} key - 환경변수 키
 * @returns {string} 환경변수 값
 */
function requireEnv(key) {
    const value = process.env[key];

    if (!value) {
        throw new Error(`[ENV] 필수 환경변수 누락: ${key}`);
    }

    return value;
}

module.exports = {
    validateEnv,
    getEnv,
    requireEnv,
    REQUIRED_ENV,
    OPTIONAL_ENV,
    DEV_DEFAULTS
};
