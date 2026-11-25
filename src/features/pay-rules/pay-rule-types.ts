import type { TimeSlot } from '@/lib/types/season';

export type PayType = 'per_class' | 'monthly' | 'daily' | 'fixed_total';

export interface PayInstallment {
  pay_year_month: string; // 넣을 급여 명세서(일한 달)
  amount: number;
}

export interface PayRule {
  id: number;
  instructor_id: number;
  instructor_name: string;
  season_id: number | null;
  season_name: string | null;
  start_date: string | null;
  end_date: string | null;
  pay_type: PayType;
  amount: number;
  time_slots: TimeSlot[];
  taxable: boolean;
  memo: string | null;
  installments: PayInstallment[];
}

export interface PayRuleForm {
  pay_type: PayType;
  amount: number;
  start_date: string;
  end_date: string;
  time_slots: TimeSlot[];
  taxable: boolean;
  memo: string;
  installments: PayInstallment[];
}

export interface PayRulePayload extends Omit<PayRuleForm, 'start_date' | 'end_date'> {
  start_date: string | null;
  end_date: string | null;
  confirm_mismatch?: boolean;
}

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  fixed_total: '고정 총액',
  per_class: '수업당',
  daily: '하루당',
  monthly: '월급',
};
