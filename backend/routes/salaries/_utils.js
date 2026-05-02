/**
 * Salaries Sub-Router 의존성 Re-Export 모듈
 * ----------------------------------------------------------------
 * 분리 정책 (ADR-006 / ADR-017 / ADR-014):
 *   - backend/routes/salaries.js (단일 975줄) → backend/routes/salaries/ 디렉토리 5 파일 분리.
 *   - 본 파일은 의존성 통합 진입점. sub-라우터 (crud / calculation / payment) 가
 *     동일 인스턴스 (DB pool / 보안 헬퍼 / 외부 헬퍼 / logger) 를 require 하기 위한 얇은 layer.
 *
 * DB pool (ADR-005 / ADR-011):
 *   - `db` (기존 이름) + `pool` (신규 표준 이름) 동일 인스턴스 두 이름으로 export.
 *   - sub-라우터에서는 `pool.execute(sql, params)` 표준 사용.
 *
 * 보안 영역 (ADR-007):
 *   - `decrypt(value)` (강사 이름 복호화) 시그니처 무변경 — utils/encryption.js 동일 인스턴스 노출.
 *   - bcrypt / JWT / 결제 API 미사용. 자율 진행 가능.
 *
 * 응답 표면 보존 (ADR-013):
 *   - decryptInstructorName / decryptSalaryArray 헬퍼 시그니처 보존 — sub-라우터 응답 객체의
 *     `instructor_name` / `name` 필드만 복호화하여 root 키 (`{salary, salaries, instructor}`) 보존.
 *
 * 헬퍼 (분리 시 중복 정의 회피):
 *   - timeSlotLabels: morning/afternoon/evening 한국어 라벨 (work-summary / detail / recalculate 공통).
 */
const db = require('../../config/database');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { calculateInstructorSalary } = require('../../utils/salaryCalculator');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');

// ADR-005 / ADR-011: 신규 표준 이름 alias
const pool = db;

// ADR-013: 응답 표면 보존 헬퍼 (instructor_name / name 필드만 복호화)
function decryptInstructorName(obj) {
    if (!obj) return obj;
    if (obj.instructor_name) obj.instructor_name = decrypt(obj.instructor_name);
    if (obj.name) obj.name = decrypt(obj.name);
    return obj;
}

function decryptSalaryArray(arr) {
    return arr.map(item => decryptInstructorName({ ...item }));
}

// 공통 라벨 (work-summary / detail / recalculate 동일 매핑)
const timeSlotLabels = { morning: '오전', afternoon: '오후', evening: '저녁' };

module.exports = {
    db,
    pool,
    verifyToken,
    requireRole,
    checkPermission,
    calculateInstructorSalary,
    decrypt,
    logger,
    decryptInstructorName,
    decryptSalaryArray,
    timeSlotLabels,
};
