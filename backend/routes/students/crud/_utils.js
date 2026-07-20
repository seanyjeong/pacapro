/**
 * routes/students/crud/_utils.js
 *
 * 학생 CRUD sub-라우터 공통 헬퍼 / 의존성 re-export 모듈.
 *
 * ## 마운트 / 분리 배경
 * - 원본: `routes/students/crud.js` (1,638줄 단일, 6 endpoint).
 * - 분리: `routes/students/crud/` 디렉토리 + 7 파일 (Phase 3 #4, ADR-017 자율 진행).
 * - 부모 `routes/students/index.js` 의 `require('./crud')(router)` 호출이 Node require resolve
 *   자동 처리로 디렉토리/index.js 마운트 (부모 무수정).
 *
 * ## DB 패턴 (ADR-005)
 * - 신규 표준: `pool.execute(sql, params)` (prepared statement, binary protocol).
 * - 점진 마이그레이션 alias (ADR-011): `db` 와 `pool` 둘 다 동일 인스턴스로 export.
 *
 * ## 보안 헬퍼 (ADR-007)
 * - encryption (`encrypt`, `decrypt`, `decryptFields`, `decryptArrayFields`, `ENCRYPTED_FIELDS`)
 *   및 인증 미들웨어 (`verifyToken`, `requireRole`, `checkPermission`) 시그니처 무변경 re-export.
 * - 본 모듈에서 보안 로직 재구현 절대 금지.
 *
 * ## 도메인 헬퍼 (../_utils.js)
 * - `parseClassDaysWithSlots`, `extractDayNumbers`, `autoAssignStudentToSchedules`,
 *   `reassignStudentSchedules`, `truncateToThousands` 는 부모 `routes/students/_utils.js`
 *   에서 그대로 가져와 sub-라우터들에 재공급.
 *
 * ## 응답 표면 (ADR-013)
 * - 6 endpoint 모두 기존 응답 표면 보존:
 *   * GET / : `{message, students[]}`
 *   * GET /:id : `{student, performances, payments}`
 *   * POST / : `{message, student}` (201) + 409 SAME_NAME_EXISTS 시 `{error, code, message, existingStudent}`
 *   * PUT /:id : `{message, student}` (+ 옵션 필드 firstPaymentFromPending / trialAssignResult / scheduleReassign)
 *   * DELETE /:id : `{message, student:{id, name}}`
 *   * GET /search : `{message, students[]}`
 * - 프론트 `src/components/students/student-form.tsx` (1,450줄) + `src/lib/api/students.ts`
 *   (317줄) + `src/lib/types/student.ts` (StudentsResponse / StudentDetailResponse /
 *   StudentCreateResponse / StudentUpdateResponse / StudentDeleteResponse) 가 root 키 직접 소비.
 * - `{data, meta}` / `{error: {code, message}}` RULES 표준 이전은 응답 통일 트랙 (프론트 동시 변경) 으로 분리.
 *
 * ## 모듈 경계
 * - 학생 수정의 결제·스케줄 후처리는 `crud/update/` 아래에서 분리 관리한다.
 */

const db = require('../../../config/database');
// pool alias (ADR-011): 신규 sub-라우터는 pool.execute 사용 권장
const pool = db;

const { verifyToken, requireRole, checkPermission } = require('../../../middleware/auth');
const {
    encrypt,
    decrypt,
    decryptFields,
    decryptArrayFields,
    ENCRYPTED_FIELDS
} = require('../../../utils/encryption');
const { logAudit, getAuditInfoFromReq } = require('../../../utils/auditLogger');
const logger = require('../../../utils/logger');

// 도메인 헬퍼 (부모 routes/students/_utils.js)
const {
    parseClassDaysWithSlots,
    extractDayNumbers,
    normalizeStudentClassDays,
    autoAssignStudentToSchedules,
    reassignStudentSchedules,
    truncateToThousands
} = require('../_utils');

module.exports = {
    db,
    pool,
    verifyToken,
    requireRole,
    checkPermission,
    encrypt,
    decrypt,
    decryptFields,
    decryptArrayFields,
    ENCRYPTED_FIELDS,
    logAudit,
    getAuditInfoFromReq,
    logger,
    parseClassDaysWithSlots,
    extractDayNumbers,
    normalizeStudentClassDays,
    autoAssignStudentToSchedules,
    reassignStudentSchedules,
    truncateToThousands
};
