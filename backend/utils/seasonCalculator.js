/**
 * 시즌 전환 로직 및 일할 계산 유틸리티
 *
 * 참고: docs/시즌전환로직분석.md
 *
 * 핵심 기능:
 * 1. 일할 계산 (비시즌 종강일까지의 월회비 계산)
 * 2. 시즌 중도 해지 환불 계산
 */

/**
 * 금액을 천원 단위로 절삭 (백원 단위 버림)
 * @param {number} amount - 금액
 * @returns {number} 천원 단위로 절삭된 금액
 */
function truncateToThousands(amount) {
    return Math.floor(amount / 1000) * 1000;
}

/**
 * 시즌 중간 합류 시 시즌비 일할계산
 * @param {object} params - 계산 파라미터
 * @param {number} params.seasonFee - 기본 시즌비
 * @param {Date} params.seasonStartDate - 시즌 시작일
 * @param {Date} params.seasonEndDate - 시즌 종료일
 * @param {Date} params.joinDate - 합류일 (등록일)
 * @param {Array<number>} params.weeklyDays - 수업 요일
 * @returns {object} 일할 계산 결과
 */
function calculateMidSeasonFee(params) {
    const { seasonFee, seasonStartDate, seasonEndDate, joinDate, weeklyDays } = params;

    // 합류일이 시즌 시작일보다 이전이면 전액
    if (joinDate <= seasonStartDate) {
        return {
            originalFee: seasonFee,
            proRatedFee: seasonFee,
            discount: 0,
            totalDays: 0,
            remainingDays: 0,
            isProRated: false,
            details: '시즌 시작 전 등록 - 일할계산 없음'
        };
    }

    // 합류일이 시즌 종료일 이후면 0
    if (joinDate > seasonEndDate) {
        return {
            originalFee: seasonFee,
            proRatedFee: 0,
            discount: seasonFee,
            totalDays: 0,
            remainingDays: 0,
            isProRated: true,
            details: '시즌 종료 후 등록 - 시즌비 없음'
        };
    }

    // 전체 시즌 수업일수 계산
    const totalClassDays = countClassDays(seasonStartDate, seasonEndDate, weeklyDays);

    // 합류일부터 시즌 종료일까지 남은 수업일수 계산
    const remainingClassDays = countClassDays(joinDate, seasonEndDate, weeklyDays);

    if (totalClassDays === 0) {
        return {
            originalFee: seasonFee,
            proRatedFee: seasonFee,
            discount: 0,
            totalDays: 0,
            remainingDays: 0,
            isProRated: false,
            details: '수업일이 없음'
        };
    }

    // 일할계산: 시즌비 × (남은 수업일 / 전체 수업일), 천원 단위 절삭
    const proRatedFee = truncateToThousands(seasonFee * (remainingClassDays / totalClassDays));
    const discount = seasonFee - proRatedFee;

    return {
        originalFee: seasonFee,
        proRatedFee,
        discount,
        totalDays: totalClassDays,
        remainingDays: remainingClassDays,
        isProRated: true,
        details: `${seasonFee.toLocaleString()}원 × (${remainingClassDays}/${totalClassDays}일) = ${proRatedFee.toLocaleString()}원`
    };
}

/**
 * 특정 기간 동안의 수업 횟수 계산
 * @param {Date} startDate - 시작일
 * @param {Date} endDate - 종료일
 * @param {Array<number>} weeklyDays - 수업 요일 (0=일요일, 1=월요일, ..., 6=토요일)
 * @returns {number} 수업 횟수
 */
function countClassDays(startDate, endDate, weeklyDays) {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (weeklyDays.includes(dayOfWeek)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

/**
 * 일할 계산 (비시즌 종강일까지의 월회비 계산)
 * @param {object} params - 계산 파라미터
 * @param {number} params.monthlyFee - 월회비
 * @param {Array<number>} params.weeklyDays - 수업 요일 배열 [1,3,5] = 월,수,금
 * @param {Date} params.nonSeasonEndDate - 비시즌 종강일
 * @param {number} params.discountRate - 할인율 (0-100)
 * @returns {object} 일할 계산 결과
 */
function calculateProRatedFee(params) {
    const {
        monthlyFee,
        weeklyDays,
        nonSeasonEndDate,
        discountRate = 0
    } = params;

    // Step 1: 비시즌 종강일이 속한 달의 1일
    const year = nonSeasonEndDate.getFullYear();
    const month = nonSeasonEndDate.getMonth();
    const startDate = new Date(year, month, 1);

    // Step 2: 해당 월의 마지막 날
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Step 3: 비시즌 종강일까지 수업 횟수 계산
    const classCountUntilEnd = countClassDays(startDate, nonSeasonEndDate, weeklyDays);

    // Step 4: 해당 월 전체 수업 횟수 (4주 고정: 주간횟수 × 4)
    const totalMonthlyClasses = weeklyDays.length * 4;

    // Step 5: 회당 단가 계산
    const perClassFee = monthlyFee / totalMonthlyClasses;

    // Step 6: 일할 계산
    let proRatedFee = Math.floor(perClassFee * classCountUntilEnd);

    // Step 7: 할인 적용
    const discountAmount = Math.floor(proRatedFee * (discountRate / 100));
    const finalAmount = truncateToThousands(proRatedFee - discountAmount);

    return {
        proRatedFee: finalAmount,
        baseAmount: proRatedFee,
        discountAmount,
        classCountUntilEnd,
        totalMonthlyClasses,
        perClassFee: Math.floor(perClassFee),
        periodStart: startDate.toISOString().split('T')[0],
        periodEnd: nonSeasonEndDate.toISOString().split('T')[0],
        calculationDetails: {
            formula: `${monthlyFee.toLocaleString()}원 ÷ ${totalMonthlyClasses}회 × ${classCountUntilEnd}회 = ${proRatedFee.toLocaleString()}원`,
            description: `${startDate.getMonth() + 1}월 1일 ~ ${nonSeasonEndDate.getDate()}일까지 ${classCountUntilEnd}회 수업`
        }
    };
}

/**
 * 시즌 중도 해지 환불 계산 (개선된 버전)
 * - 실제 납부 금액 기준 계산
 * - 부가세 옵션
 * - 학원법 기준 안내 표시
 *
 * @param {object} params - 계산 파라미터
 * @param {number} params.paidAmount - 실제 납부한 금액 (할인 적용 후)
 * @param {number} params.originalFee - 원래 시즌비 (할인 전)
 * @param {Date} params.seasonStartDate - 시즌 시작일
 * @param {Date} params.seasonEndDate - 시즌 종료일
 * @param {Date} params.cancellationDate - 해지 요청일 (퇴원일)
 * @param {Array<number>} params.weeklyDays - 수업 요일
 * @param {boolean} params.includeVat - 부가세 10% 제외 여부
 * @returns {object} 환불 계산 결과
 */
function calculateSeasonRefund(params) {
    const {
        paidAmount,          // 실제 납부 금액
        originalFee,         // 원래 시즌비 (없으면 paidAmount 사용)
        seasonStartDate,
        seasonEndDate,
        cancellationDate,
        weeklyDays,
        includeVat = false   // 부가세 제외 여부
    } = params;

    // 하위 호환성: seasonFee가 있으면 paidAmount로 사용
    const actualPaidAmount = paidAmount || params.seasonFee || 0;
    const actualOriginalFee = originalFee || params.seasonFee || actualPaidAmount;

    // Step 1: 시즌 전체 수업일 계산
    const totalClassDays = countClassDays(seasonStartDate, seasonEndDate, weeklyDays);

    // Step 2: 이용한 수업일수 계산 (시작일 ~ 퇴원일 전날까지)
    const cancellationDateObj = new Date(cancellationDate);
    const dayBeforeCancellation = new Date(cancellationDateObj);
    dayBeforeCancellation.setDate(dayBeforeCancellation.getDate() - 1);

    const attendedDays = countClassDays(seasonStartDate, dayBeforeCancellation, weeklyDays);
    const remainingDays = totalClassDays - attendedDays;

    // Step 3: 진행률 계산
    const progressRate = attendedDays / totalClassDays;

    // Step 4: 학원법 기준 환불 계산 (참고용)
    let legalRefundRate = 0;
    let legalRefundReason = '';
    let legalRefundAmount = 0;

    if (progressRate < 1/3) {
        legalRefundRate = 2/3;
        legalRefundReason = '총 학습시간 1/3 경과 전: 2/3 환불';
    } else if (progressRate < 1/2) {
        legalRefundRate = 1/2;
        legalRefundReason = '총 학습시간 1/2 경과 전: 1/2 환불';
    } else {
        legalRefundRate = 0;
        legalRefundReason = '총 학습시간 1/2 경과 후: 환불 불가';
    }
    legalRefundAmount = truncateToThousands(actualPaidAmount * legalRefundRate);

    // Step 5: 일할계산 기준 환불 (실제 납부금액 기준)
    const usedRate = attendedDays / totalClassDays;
    const usedAmount = truncateToThousands(actualPaidAmount * usedRate);  // 이용료
    let refundAmount = actualPaidAmount - usedAmount;  // 기본 환불금

    // Step 6: 부가세 제외 (선택)
    let vatAmount = 0;
    let refundAfterVat = refundAmount;
    if (includeVat) {
        // 환불금에서 부가세 10% 제외 (내가 낼 세금)
        vatAmount = truncateToThousands(refundAmount / 11);  // 부가세 = 환불금 / 1.1 * 0.1
        refundAfterVat = refundAmount - vatAmount;
    }

    return {
        // 기본 정보
        paidAmount: actualPaidAmount,
        originalFee: actualOriginalFee,
        discountAmount: actualOriginalFee - actualPaidAmount,

        // 수업일 정보
        totalClassDays,
        attendedDays,
        remainingDays,
        progressRate: (progressRate * 100).toFixed(1),

        // 일할계산 기준 (실제 환불)
        usedAmount,
        usedRate: (usedRate * 100).toFixed(1),
        refundAmount,
        refundRate: ((remainingDays / totalClassDays) * 100).toFixed(1),

        // 부가세 옵션
        includeVat,
        vatAmount,
        refundAfterVat,

        // 학원법 기준 (참고)
        legalRefundRate: (legalRefundRate * 100).toFixed(0),
        legalRefundReason,
        legalRefundAmount,

        // 최종 환불금 (부가세 적용 여부에 따라)
        finalRefundAmount: includeVat ? refundAfterVat : refundAmount,

        // 상세 계산 내역
        calculationDetails: {
            paidAmount: actualPaidAmount.toLocaleString() + '원',
            perClassFee: Math.floor(actualPaidAmount / totalClassDays).toLocaleString() + '원',
            usedFormula: `${actualPaidAmount.toLocaleString()}원 × (${attendedDays}일/${totalClassDays}일) = ${usedAmount.toLocaleString()}원`,
            refundFormula: `${actualPaidAmount.toLocaleString()}원 - ${usedAmount.toLocaleString()}원 = ${refundAmount.toLocaleString()}원`,
            vatFormula: includeVat ? `${refundAmount.toLocaleString()}원 - 부가세 ${vatAmount.toLocaleString()}원 = ${refundAfterVat.toLocaleString()}원` : null
        }
    };
}

/**
 * 특정 월의 수업 횟수 계산 (5주차 판단용)
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {Array<number>} classDays - 수업 요일 배열 [2,4] = 화목
 * @returns {number} 해당 월의 실제 수업 횟수
 */
function countMonthlyClassDays(year, month, classDays) {
    // month는 1-12로 받아서 0-11로 변환
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);  // 해당 월의 마지막 날
    return countClassDays(startDate, endDate, classDays);
}

/**
 * 5주차 보너스 수업 횟수 계산
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {Array<number>} classDays - 수업 요일 배열 [2,4] = 화목
 * @returns {number} 5주차 보너스 수업 횟수 (기대수업 초과분)
 */
function getFifthWeekClassCount(year, month, classDays) {
    const expectedClasses = classDays.length * 4;  // 주2회면 8회
    const actualClasses = countMonthlyClassDays(year, month, classDays);
    return Math.max(0, actualClasses - expectedClasses);  // 초과분만 반환
}

/**
 * 요일 문자열을 숫자 배열로 변환
 * @param {string} weeklyDaysString - 쉼표로 구분된 요일 문자열 ("0,2,4" 또는 "월,수,금")
 * @returns {Array<number>} 요일 숫자 배열 [1,3,5]
 */
function parseWeeklyDays(weeklyDaysString) {
    if (!weeklyDaysString) return [];

    // 이미 숫자 배열이면 그대로 반환
    if (Array.isArray(weeklyDaysString)) {
        return weeklyDaysString.map(d => parseInt(d));
    }

    // JSON 문자열인 경우
    if (weeklyDaysString.startsWith('[')) {
        return JSON.parse(weeklyDaysString);
    }

    // 쉼표로 구분된 숫자 문자열
    if (/^\d+(,\d+)*$/.test(weeklyDaysString)) {
        return weeklyDaysString.split(',').map(d => parseInt(d.trim()));
    }

    // 한글 요일 매핑
    const dayMap = {
        '일': 0, '월': 1, '화': 2, '수': 3,
        '목': 4, '금': 5, '토': 6
    };

    return weeklyDaysString.split(',').map(day => dayMap[day.trim()]).filter(d => d !== undefined);
}

/**
 * 숫자 배열을 한글 요일 문자열로 변환
 * @param {Array<number>} weeklyDays - 요일 숫자 배열 [1,3,5]
 * @returns {string} "월, 수, 금"
 */
function formatWeeklyDays(weeklyDays) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return weeklyDays.map(d => dayNames[d]).join(', ');
}

/**
 * 다음 달 청구 금액 미리보기
 * @param {object} student - 학생 정보
 * @param {object} season - 시즌 정보
 * @returns {object} 미리보기 결과
 */
function previewSeasonTransition(student, season) {
    const {
        name,
        monthly_tuition,
        discount_rate,
        weekly_schedule
    } = student;

    const {
        non_season_end_date,
        season_start_date,
        season_end_date
    } = season;

    const weeklyDays = parseWeeklyDays(weekly_schedule);
    const nonSeasonEnd = new Date(non_season_end_date);
    const seasonStart = new Date(season_start_date);

    // 일할 계산
    const proRated = calculateProRatedFee({
        monthlyFee: monthly_tuition,
        weeklyDays,
        nonSeasonEndDate: nonSeasonEnd,
        discountRate: discount_rate || 0
    });

    // 공백기 계산
    const gapStart = new Date(nonSeasonEnd);
    gapStart.setDate(gapStart.getDate() + 1);
    const gapEnd = new Date(seasonStart);
    gapEnd.setDate(gapEnd.getDate() - 1);

    const hasGap = gapStart <= gapEnd;

    return {
        studentName: name,
        monthlyFee: monthly_tuition,
        weeklySchedule: formatWeeklyDays(weeklyDays),
        nonSeasonEndDate: non_season_end_date,
        seasonStartDate: season_start_date,

        // 일할 계산 결과
        proRatedAmount: proRated.proRatedFee,
        proRatedDetails: proRated,

        // 공백기
        hasGap,
        gapPeriod: hasGap ? {
            start: gapStart.toISOString().split('T')[0],
            end: gapEnd.toISOString().split('T')[0],
            days: Math.ceil((gapEnd - gapStart) / (1000 * 60 * 60 * 24)) + 1
        } : null,

        // 요약
        summary: {
            nextMonthCharge: proRated.proRatedFee,
            chargeReason: `비시즌 종강일(${proRated.periodEnd})까지 일할 계산`,
            afterSeasonStart: '시즌비 적용 (월회비 청구 중단)'
        }
    };
}

module.exports = {
    truncateToThousands,
    calculateMidSeasonFee,
    calculateProRatedFee,
    calculateSeasonRefund,
    countClassDays,
    countMonthlyClassDays,
    getFifthWeekClassCount,
    parseWeeklyDays,
    formatWeeklyDays,
    previewSeasonTransition
};
