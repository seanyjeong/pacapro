/**
 * exports sub-라우터 공통 의존성 + 헬퍼 (Phase 2 #6, ADR-017)
 *
 * - DB pool: db (legacy) + pool (ADR-005 표준 alias) — 동일 인스턴스, 시간 두고 점진 교체
 * - 인증: verifyToken / requireRole / checkPermission re-export
 * - 보안 헬퍼: decrypt(value) 시그니처 무변경 (ADR-007)
 * - 라벨 상수: 카테고리/결제수단 한국어 표시 (ADR-003)
 * - 스타일 헬퍼: applyHeaderStyle / applyCellStyle / applyTotalRowStyle (ExcelJS row/cell 공통 포맷)
 * - decryptNames / decryptArray: 학생/강사/연락처 등 암호화 컬럼 일괄 복호화
 *
 * 분리 정책: 본 파일은 의존성 + 공통 헬퍼만 담당. 라우트 정의 X (ADR-014).
 */

const db = require('../../config/database');
const pool = db; // ADR-005 alias (ADR-011)
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const ExcelJS = require('exceljs');

/**
 * 이름 + 연락처 + 주민번호 등 암호화 컬럼 단일 객체 일괄 복호화.
 * 입력 원본을 mutate 하지 않도록 호출부에서 spread 후 전달 (decryptArray 가 보장).
 * @param {object|null|undefined} obj
 * @returns {object|null|undefined}
 */
function decryptNames(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.instructor_name) obj.instructor_name = decrypt(obj.instructor_name);
    if (obj.resident_number) obj.resident_number = decrypt(obj.resident_number);
    if (obj.name) obj.name = decrypt(obj.name);
    if (obj.phone) obj.phone = decrypt(obj.phone);
    return obj;
}

/**
 * 배열 일괄 복호화 — spread 로 사본 생성 후 decryptNames 적용.
 * @param {Array<object>} arr
 * @returns {Array<object>}
 */
function decryptArray(arr) {
    return arr.map(item => decryptNames({ ...item }));
}

// 카테고리 라벨 (한글) — 지출
const EXPENSE_CATEGORY_LABELS = {
    salary: '급여',
    utilities: '공과금',
    rent: '임대료',
    supplies: '소모품',
    marketing: '마케팅',
    refund: '환불',
    other: '기타'
};

// 카테고리 라벨 (한글) — 기타 수입
const INCOME_CATEGORY_LABELS = {
    clothing: '의류',
    shoes: '신발',
    equipment: '운동장비',
    beverage: '음료',
    snack: '간식',
    other: '기타'
};

// 결제 수단 라벨 (한글)
const PAYMENT_METHOD_LABELS = {
    cash: '현금',
    card: '카드',
    account: '계좌이체',
    other: '기타'
};

/**
 * ExcelJS 헤더 행 공통 스타일 (파란 배경 + 흰 글자 + 굵게)
 * @param {ExcelJS.Row} row
 */
function applyHeaderStyle(row) {
    row.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' },
            size: 11
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    row.height = 25;
}

/**
 * ExcelJS 데이터 셀 공통 스타일 (얇은 테두리 + 정렬)
 * @param {ExcelJS.Cell} cell
 * @param {boolean} [isAmount=false] true 면 우측 정렬 (금액 컬럼)
 */
function applyCellStyle(cell, isAmount = false) {
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    cell.alignment = {
        horizontal: isAmount ? 'right' : 'center',
        vertical: 'middle'
    };
}

/**
 * ExcelJS 합계 행 공통 스타일 (회색 배경 + 굵게 + 굵은 테두리)
 * @param {ExcelJS.Row} row
 */
function applyTotalRowStyle(row) {
    row.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
        };
        cell.font = { bold: true, size: 11 };
        cell.border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
    });
    row.height = 25;
}

module.exports = {
    db,
    pool,
    verifyToken,
    requireRole,
    checkPermission,
    decrypt,
    logger,
    ExcelJS,
    decryptNames,
    decryptArray,
    EXPENSE_CATEGORY_LABELS,
    INCOME_CATEGORY_LABELS,
    PAYMENT_METHOD_LABELS,
    applyHeaderStyle,
    applyCellStyle,
    applyTotalRowStyle
};
