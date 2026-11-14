import { formatYearMonthLabel } from './mobile-unpaid-month.mjs';
import type { MobileUnpaidScope } from './mobile-unpaid-types';

/** 화면 제목·설명 문구(범위에 따라 바뀜) */
export function getMobileUnpaidHeading(scope: MobileUnpaidScope, selectedMonth: string, dayName: string) {
  const isMonthlyScope = scope === 'month';
  return {
    title: isMonthlyScope ? `${formatYearMonthLabel(selectedMonth)} 전체 미납자` : '오늘 출석 미납자',
    description: isMonthlyScope
      ? '학원 전체 학생의 청구 기준'
      : dayName
        ? `${dayName}요일 수업 학생 중`
        : '오늘 수업 학생 중',
  };
}
