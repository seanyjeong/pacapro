/**
 * routes/notifications/_utils.js
 *
 * notifications 도메인 (send / test / settings / logs) 전용 공용 헬퍼.
 *  - DB 풀, 인증 미들웨어, 발송 채널 헬퍼 (네이버 SENS / 솔라피),
 *    학생 정보 복호화 헬퍼, 로거를 한 곳에서 묶어 하위 라우터에 재공급한다.
 *
 * 설계 원칙 (paca 리팩 RULES.md 준수):
 *  - 이 파일은 "라우팅" 을 갖지 않는다. 순수 헬퍼 / 재공급 모듈이다.
 *  - DB 호출 패턴은 ADR-005 에 따라 pool.execute(sql, params) 가 정답.
 *    다만 기존 하위 라우터들이 db.query 를 사용하고 있어 한 번에 변경 시
 *    회귀 위험이 크므로, 본 파일은 db 와 pool 두 이름으로 같은 mysql2 풀을
 *    노출하여 점진 마이그레이션 도로를 깐다.
 *  - 보안 헬퍼 (encryption.decrypt, encryptApiKey, decryptApiKey) 의 시그니처
 *    및 동작은 이 파일에서 절대 변형하지 않는다 (ADR-007).
 *  - 사용자 노출 메시지는 이 파일에서 직접 응답하지 않는다 (헬퍼 모듈).
 *    운영자 경고는 한국어 친화 메시지로 통일.
 */

const pool = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const {
    encryptApiKey,
    decryptApiKey,
    sendAlimtalk,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
} = require('../../utils/naverSens');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const {
    sendAlimtalkSolapi,
    getBalanceSolapi,
} = require('../../utils/solapi');

// 역호환 별칭: 기존 하위 라우터가 사용하는 db 이름을 유지.
//   신규 코드는 pool 이름을 사용해 RULES ADR-005 (pool.execute 통일) 와
//   정렬한다. 둘은 동일한 mysql2 promise 풀 인스턴스다.
const db = pool;

/**
 * 단일 학생/연락처 row 의 암호화 필드를 복호화한다.
 *
 * 주의:
 *  - 입력 객체를 in-place 로 mutate 한다 (성능/호환 이유).
 *    호출자가 원본을 보존해야 한다면 decryptStudentArray 처럼
 *    먼저 spread 복사 (`{...row}`) 한 후 전달할 것.
 *  - 알려진 필드 (student_name / parent_phone / student_phone / phone / name)
 *    만 복호화하고, 다른 필드는 건드리지 않는다.
 *  - null / undefined 는 그대로 반환한다.
 *
 * @param {object|null|undefined} obj
 * @returns {object|null|undefined}
 */
function decryptStudentInfo(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.parent_phone) obj.parent_phone = decrypt(obj.parent_phone);
    if (obj.student_phone) obj.student_phone = decrypt(obj.student_phone);
    if (obj.phone) obj.phone = decrypt(obj.phone);  // 체험수업 등에서 phone 필드 사용
    if (obj.name) obj.name = decrypt(obj.name);
    return obj;
}

/**
 * 학생/연락처 row 배열을 복호화한다 (원본 비파괴).
 *  - 각 row 를 spread 복사한 뒤 decryptStudentInfo 적용 → 원본 배열 mutate X.
 *
 * @param {Array<object>} arr
 * @returns {Array<object>}
 */
function decryptStudentArray(arr) {
    return arr.map(item => decryptStudentInfo({ ...item }));
}

// 암호화 키 (환경변수에서 가져옴) — 보안 영역.
//  - paca 운영 환경에서는 반드시 설정되어야 하며,
//    미설정 시 발송 시점에 복호화가 실패하여 사용자 데이터가 깨진 상태로 노출될 수 있음.
//  - 운영자가 즉시 인지할 수 있도록 한국어 친화 경고 메시지로 로깅.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    logger.warn('[notifications] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. 암호화 헬퍼가 정상 동작하지 않을 수 있으니 .env 설정을 확인해주세요.');
}

module.exports = {
    // DB
    db,
    pool,        // ADR-005 정렬용 신규 별칭. 신규 코드는 pool.execute 사용 권장.
    // 인증
    verifyToken,
    checkPermission,
    // 네이버 SENS 채널
    encryptApiKey,
    decryptApiKey,
    sendAlimtalk,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
    // 솔라피 채널
    sendAlimtalkSolapi,
    getBalanceSolapi,
    // 암호화
    decrypt,
    ENCRYPTION_KEY,
    // 학생 정보 복호화 헬퍼
    decryptStudentInfo,
    decryptStudentArray,
    // 로거
    logger,
};
