/**
 * paca/payments/_utils.js — payments 도메인 sub-라우터 공통 유틸 (Phase 3 #6, ADR-017 자율 진행)
 *
 * 사용처: payments/{list,credits,crud,bulk,pay,prepaid,stats}.js
 *
 * 제공:
 *   - pool/db (mysql2 promise pool, ADR-005/ADR-011 alias) — pool 신규 표준 / db 호환
 *   - decrypt (utils/encryption — ADR-007 보안 헬퍼 시그니처 무변경)
 *   - logger (utils/logger)
 *   - seasonCalculator 헬퍼 3종 (truncateToThousands / calculateProRatedFee / parseWeeklyDays)
 *   - calculateDueDate (utils/dueDateCalculator)
 *   - decryptStudentName / decryptPaymentArray — 학생 이름 복호화 헬퍼
 *   - calculateNonSeasonEndProrated — 비시즌 종강 일할 계산 헬퍼 (bulk + crud sub-라우터 공유)
 *
 * 보안 영역 (ADR-007) — 자동 변경 금지 영역:
 *   - decrypt (utils/encryption) 시그니처 무변경 = 호출만 함
 *   - bcrypt / JWT 직접 사용 X (verifyToken 미들웨어가 처리)
 *   - 외부 결제 API 호출 X (toss 는 별도 도메인)
 *   - 결제 데이터 영속 변경 X (분리/표면만, 동작 1:1 보존) — 사장님 결정 (2026-05-02)
 *
 * ADR-005 (pool.execute 통일): 본 파일 + sub-라우터 모두 pool.execute / conn.execute.
 * ADR-013 응답 표면 보존: 프론트 src/lib/api/payments.ts (paymentsAPI) + src/lib/types/payment.ts
 *   가 root 키 직접 소비 (message / payments / payment / stats / created / updated 등) 1:1 보존.
 */

const pool = require('../../config/database');
const { decrypt } = require('../../utils/encryption');
const { truncateToThousands, calculateProRatedFee, parseWeeklyDays } = require('../../utils/seasonCalculator');
const { calculateDueDate } = require('../../utils/dueDateCalculator');
const logger = require('../../utils/logger');

// pool 의 alias (ADR-011 — 신규 표준은 pool, 호환을 위해 db 도 노출)
const db = pool;

// ============================================
// 학생 이름 복호화 헬퍼 (ADR-007 — decrypt 호출만)
// ============================================

/**
 * 결제 객체의 학생 이름 필드 (student_name / name) 를 복호화.
 * mutation 이 아니라 obj 자체를 변형 — 호출자가 spread/copy 책임.
 * @param {object|null} obj - 결제/학생 객체
 * @returns {object|null} 동일 obj (편의를 위해 반환)
 */
function decryptStudentName(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.name) obj.name = decrypt(obj.name);
    return obj;
}

/**
 * 결제 배열의 학생 이름 필드를 복호화.
 * spread copy 후 변형 — 원본 배열/항목 mutation 없음.
 * @param {Array<object>} arr - 결제 배열
 * @returns {Array<object>} 새 배열
 */
function decryptPaymentArray(arr) {
    return arr.map(item => decryptStudentName({ ...item }));
}

// ============================================
// 비시즌 종강 일할 계산 (bulk + crud sub-라우터 공유)
// ============================================

/**
 * 비시즌 종강 일할 계산 (다음 달 비시즌 종강일까지의 수업료)
 *
 * 사용처:
 *   - payments/bulk.js POST /bulk-monthly (학원 전체)
 *   - payments/bulk.js POST /generate-monthly-for-student (개별)
 *
 * 동작 1:1 보존 (원본 routes/payments.js lines 30-113):
 *   - DB 호출 ADR-005 (db.query → pool.execute) 만 적용
 *   - parseWeeklyDays / calculateProRatedFee 헬퍼 의존성 무변경
 *   - 반환 셰이프 ({ amount, seasonName, nonSeasonEndDate, classCount, totalMonthlyClasses, description, details })
 *     1:1 보존 (호출자가 amount/description/details 직접 소비)
 *
 * @param {object} params
 * @param {number} params.studentId
 * @param {number} params.academyId
 * @param {number} params.year
 * @param {number} params.month
 * @returns {Promise<object|null>}
 */
async function calculateNonSeasonEndProrated(params) {
    const { studentId, academyId, year, month } = params;

    // 다음 달 계산
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear = year + 1;
    }

    // 다음 달에 시작하는 시즌 조회 (해당 학생이 등록된)
    const [seasonEnrollments] = await pool.execute(
        `SELECT
            se.id as enrollment_id,
            se.student_id,
            s.id as season_id,
            s.name as season_name,
            s.start_date,
            s.end_date,
            s.non_season_end_date,
            st.monthly_tuition,
            st.discount_rate,
            st.weekly_schedule
        FROM student_seasons se
        JOIN seasons s ON se.season_id = s.id
        JOIN students st ON se.student_id = st.id
        WHERE se.student_id = ?
        AND se.status = 'active'
        AND s.academy_id = ?
        AND YEAR(s.start_date) = ?
        AND MONTH(s.start_date) = ?
        AND s.non_season_end_date IS NOT NULL
        AND s.non_season_end_date >= ?`,
        [studentId, academyId, nextYear, nextMonth, `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`]
    );

    if (seasonEnrollments.length === 0) {
        return null;
    }

    const enrollment = seasonEnrollments[0];
    const nonSeasonEndDate = new Date(enrollment.non_season_end_date);

    // 비시즌 종강일이 다음 달 1일 이후인지 확인
    const nextMonthStart = new Date(nextYear, nextMonth - 1, 1);
    if (nonSeasonEndDate < nextMonthStart) {
        return null; // 비시즌 종강일이 다음 달 전이면 일할 계산 필요 없음
    }

    // 비시즌 종강일이 시즌 시작일 이후이면 일할 계산 필요 없음
    const seasonStartDate = new Date(enrollment.start_date);
    if (nonSeasonEndDate >= seasonStartDate) {
        return null;
    }

    // 수업 요일 파싱
    const weeklyDays = parseWeeklyDays(enrollment.weekly_schedule);
    if (weeklyDays.length === 0) {
        return null;
    }

    // 비시즌 종강 일할 계산
    const proRatedResult = calculateProRatedFee({
        monthlyFee: parseFloat(enrollment.monthly_tuition) || 0,
        weeklyDays,
        nonSeasonEndDate,
        discountRate: parseFloat(enrollment.discount_rate) || 0
    });

    if (proRatedResult.proRatedFee <= 0) {
        return null;
    }

    return {
        amount: proRatedResult.proRatedFee,
        seasonName: enrollment.season_name,
        nonSeasonEndDate: enrollment.non_season_end_date,
        classCount: proRatedResult.classCountUntilEnd,
        totalMonthlyClasses: proRatedResult.totalMonthlyClasses,
        description: `비시즌 종강 일할 (${nextMonth}월 1일~${nonSeasonEndDate.getDate()}일, ${proRatedResult.classCountUntilEnd}회)`,
        details: proRatedResult.calculationDetails
    };
}

module.exports = {
    pool,
    db,
    decrypt,
    truncateToThousands,
    calculateProRatedFee,
    parseWeeklyDays,
    calculateDueDate,
    logger,
    decryptStudentName,
    decryptPaymentArray,
    calculateNonSeasonEndProrated,
};
