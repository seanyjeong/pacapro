/**
 * 데이터 암호화/복호화 유틸리티
 * Phase 1: 서버 ENV 키 기반 AES-256-GCM 암호화
 */

const crypto = require('crypto');

// 환경변수에서 암호화 키 가져오기 (32바이트 = 256비트)
// 주의: 기본값 제거됨! env-validator.js에서 개발환경 기본값 설정됨
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY;

// 프로덕션 환경에서 키 없으면 경고 (서버는 시작하지만 암호화 실패할 것)
if (!ENCRYPTION_KEY && process.env.NODE_ENV !== 'development') {
    console.error('[ENCRYPTION] ⚠️ DATA_ENCRYPTION_KEY 미설정! 암호화 기능이 작동하지 않습니다.');
}

// 암호화 키를 32바이트로 맞추기
function getKey() {
    const key = ENCRYPTION_KEY;
    if (!key) {
        throw new Error('[ENCRYPTION] DATA_ENCRYPTION_KEY가 설정되지 않았습니다.');
    }
    if (key.length === 32) {
        return Buffer.from(key, 'utf8');
    }
    // 키가 32바이트가 아니면 SHA-256 해시로 변환
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * 데이터 암호화
 * @param {string} plaintext - 암호화할 평문
 * @returns {string} - Base64 인코딩된 암호문 (iv + authTag + encrypted)
 */
function encrypt(plaintext) {
    if (!plaintext || plaintext === '') {
        return plaintext; // null, undefined, 빈 문자열은 그대로 반환
    }

    // 이미 암호화된 데이터인지 확인 (ENC: 접두사)
    if (typeof plaintext === 'string' && plaintext.startsWith('ENC:')) {
        return plaintext;
    }

    try {
        const iv = crypto.randomBytes(16); // 초기화 벡터
        const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);

        const encrypted = Buffer.concat([
            cipher.update(String(plaintext), 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag(); // 인증 태그 (16바이트)

        // iv(16) + authTag(16) + encrypted 결합 후 Base64 인코딩
        const combined = Buffer.concat([iv, authTag, encrypted]);
        return 'ENC:' + combined.toString('base64');
    } catch (error) {
        console.error('Encryption error:', error);
        return plaintext; // 실패 시 원본 반환
    }
}

/**
 * 데이터 복호화
 * @param {string} ciphertext - Base64 인코딩된 암호문
 * @returns {string} - 복호화된 평문
 */
function decrypt(ciphertext) {
    if (!ciphertext || ciphertext === '') {
        return ciphertext; // null, undefined, 빈 문자열은 그대로 반환
    }

    // 암호화되지 않은 데이터 (ENC: 접두사 없음)
    if (typeof ciphertext === 'string' && !ciphertext.startsWith('ENC:')) {
        return ciphertext; // 평문 그대로 반환
    }

    try {
        // ENC: 접두사 제거
        const base64Data = ciphertext.substring(4);
        const data = Buffer.from(base64Data, 'base64');

        const iv = data.slice(0, 16);
        const authTag = data.slice(16, 32);
        const encrypted = data.slice(32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Decryption error:', error);
        return ciphertext; // 실패 시 원본 반환 (이미 평문일 수 있음)
    }
}

/**
 * 객체의 지정된 필드들을 암호화
 * @param {Object} obj - 원본 객체
 * @param {string[]} fields - 암호화할 필드명 배열
 * @returns {Object} - 암호화된 객체 (새 객체 반환)
 */
function encryptFields(obj, fields) {
    if (!obj) return obj;

    const result = { ...obj };
    for (const field of fields) {
        if (result[field] !== undefined && result[field] !== null) {
            result[field] = encrypt(result[field]);
        }
    }
    return result;
}

/**
 * 객체의 지정된 필드들을 복호화
 * @param {Object} obj - 암호화된 객체
 * @param {string[]} fields - 복호화할 필드명 배열
 * @returns {Object} - 복호화된 객체 (새 객체 반환)
 */
function decryptFields(obj, fields) {
    if (!obj) return obj;

    const result = { ...obj };
    for (const field of fields) {
        if (result[field] !== undefined && result[field] !== null) {
            result[field] = decrypt(result[field]);
        }
    }
    return result;
}

/**
 * 배열의 각 객체에서 지정된 필드들을 복호화
 * @param {Object[]} arr - 암호화된 객체 배열
 * @param {string[]} fields - 복호화할 필드명 배열
 * @returns {Object[]} - 복호화된 객체 배열
 */
function decryptArrayFields(arr, fields) {
    if (!arr || !Array.isArray(arr)) return arr;
    return arr.map(obj => decryptFields(obj, fields));
}

// 암호화 대상 필드 정의
const ENCRYPTED_FIELDS = {
    students: ['name', 'phone', 'parent_phone', 'address'],
    instructors: ['name', 'phone', 'address', 'resident_number', 'account_number', 'account_holder'],
    consultations: ['student_name', 'student_phone', 'parent_name', 'parent_phone', 'notes'],
    users: ['name', 'phone']
};

module.exports = {
    encrypt,
    decrypt,
    encryptFields,
    decryptFields,
    decryptArrayFields,
    ENCRYPTED_FIELDS
};
