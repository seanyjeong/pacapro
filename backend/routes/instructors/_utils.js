/**
 * routes/instructors/_utils.js
 *
 * 강사 sub-라우터 공통 헬퍼 / 의존성 re-export 모듈.
 *
 * ## 마운트
 * - paca.js 자동 라우트 등록 (W-6) 이 `routes/instructors/` 디렉토리를 발견하면
 *   `instructors/index.js` 를 require 하여 `app.use('/paca/instructors', router)` 로 마운트한다.
 * - 본 파일은 endpoint 정의 X. sub-라우터 4개 (auth / overtime / attendance / crud) 가
 *   공통으로 사용하는 의존성 / 헬퍼 / 상수만 한 곳에서 export.
 *
 * ## DB 패턴 (ADR-005)
 * - 신규 표준: `pool.execute(sql, params)` (prepared statement, binary protocol)
 * - 점진 마이그레이션 alias (ADR-011): `db` 와 `pool` 둘 다 동일 인스턴스로 export.
 *   기존 `db.query(...)` 호출은 mysql2 promise pool 에서 안전하게 동작 (text protocol),
 *   하위 sub-라우터 마이그레이션은 `pool.execute` 로 통일.
 *
 * ## 보안 헬퍼 (ADR-007)
 * - encryption (`encrypt`, `decrypt`, `decryptFields`, `decryptArrayFields`, `ENCRYPTED_FIELDS`)
 *   및 인증 미들웨어 (`verifyToken`, `requireRole`, `checkPermission`) 는 시그니처 무변경 re-export.
 * - 본 모듈에서 보안 로직 재구현 절대 금지.
 *
 * ## 응답 표면 (ADR-013)
 * - sub-라우터들은 모두 기존 응답 표면 (`{message, instructors|instructor|attendance|...}`)
 *   을 보존한다. 프론트 (`src/lib/api/instructors.ts`, `src/lib/types/instructor.ts`) 가
 *   root 키 (`instructors`, `instructor`, `requests`, `attendances`, `verified`) 를 직접 소비.
 * - `{data, meta}` / `{error: {code, message}}` RULES 표준 이전은 응답 통일 트랙 (프론트 동시 변경) 으로 분리.
 */

const db = require('../../config/database');
// pool alias (ADR-011): 신규 sub-라우터는 pool.execute 사용 권장
const pool = db;

const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { updateSalaryFromAttendance } = require('../../utils/salaryCalculator');
const {
    encrypt,
    decrypt,
    encryptFields,
    decryptFields,
    decryptArrayFields,
    ENCRYPTED_FIELDS
} = require('../../utils/encryption');
const { syncPeakTrainerAsync } = require('../../utils/peak-trainer-sync');
const logger = require('../../utils/logger');

module.exports = {
    db,
    pool,
    verifyToken,
    requireRole,
    checkPermission,
    updateSalaryFromAttendance,
    encrypt,
    decrypt,
    encryptFields,
    decryptFields,
    decryptArrayFields,
    ENCRYPTED_FIELDS,
    syncPeakTrainerAsync,
    logger
};
