import type { SalaryAdjustment, SalaryCalculationDetails } from '@/lib/types/salary';

/** 급여 줄 단위 내역(서버가 계산할 때 저장한 것). 예전 급여는 없다. */
export function parseCalculationDetails(value: string | object | null | undefined): SalaryCalculationDetails | null {
  if (!value) return null;
  try {
    const parsed = (typeof value === 'string' ? JSON.parse(value) : value) as SalaryCalculationDetails;
    return Array.isArray(parsed.base_lines) && parsed.base_lines.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** 조정 금액은 원 단위 그대로 보여 준다 */
export function formatSignedWon(amount: number): string {
  const value = Number(amount) || 0;
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('ko-KR')}원`;
}

export function sumAdjustments(adjustments: SalaryAdjustment[]): number {
  return adjustments.reduce((sum, item) => sum + Number(item.amount), 0);
}
