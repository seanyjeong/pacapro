import axios from 'axios';
import type { TimeSlot } from '@/lib/types/season';
import { PAY_TYPE_LABELS, type PayRule, type PayRuleForm, type PayRulePayload } from './pay-rule-types';

export const SLOT_OPTIONS: Array<{ value: TimeSlot; label: string }> = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

export function emptyPayRuleForm(overrides: Partial<PayRuleForm> = {}): PayRuleForm {
  return { pay_type: 'fixed_total', amount: 0, start_date: '', end_date: '', time_slots: ['morning', 'afternoon', 'evening'], taxable: true, memo: '', installments: [], ...overrides };
}

export function toPayRuleForm(rule: PayRule): PayRuleForm {
  return {
    pay_type: rule.pay_type, amount: Number(rule.amount), start_date: rule.start_date?.slice(0, 10) ?? '', end_date: rule.end_date?.slice(0, 10) ?? '',
    time_slots: rule.time_slots, taxable: rule.taxable, memo: rule.memo ?? '',
    installments: rule.installments.map((item) => ({ pay_year_month: item.pay_year_month, amount: Number(item.amount) })),
  };
}

export function toPayRulePayload(form: PayRuleForm): PayRulePayload {
  return { ...form, start_date: form.start_date || null, end_date: form.end_date || null, installments: form.pay_type === 'fixed_total' ? form.installments : [] };
}

export function installmentTotal(form: PayRuleForm): number {
  return form.installments.reduce((sum, item) => sum + item.amount, 0);
}

export function nextInstallmentMonth(form: PayRuleForm): string {
  const last = form.installments.at(-1)?.pay_year_month || form.start_date.slice(0, 7) || new Date().toISOString().slice(0, 7);
  if (form.installments.length === 0) return last;
  const [year, month] = last.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function payRuleFormError(form: PayRuleForm): string | null {
  if (!(form.amount > 0)) return '금액을 입력해 주세요.';
  if (form.start_date && form.end_date && form.start_date > form.end_date) return '끝나는 날이 시작하는 날보다 빠릅니다.';
  if (form.time_slots.length === 0) return '시간대를 하나 이상 골라 주세요.';
  if (form.pay_type !== 'fixed_total') return null;
  if (form.installments.some((item) => !item.pay_year_month || !(item.amount > 0))) return '분할 지급 달과 금액을 확인해 주세요.';
  if (new Set(form.installments.map((item) => item.pay_year_month)).size !== form.installments.length) return '같은 달에 분할 지급을 두 번 넣을 수 없습니다.';
  return null;
}

export function formatWon(amount: number): string {
  return `${Number(amount || 0).toLocaleString('ko-KR')}원`;
}

export function formatPeriod(rule: Pick<PayRule, 'start_date' | 'end_date'>): string {
  if (!rule.start_date && !rule.end_date) return '날짜 없음';
  return `${rule.start_date?.slice(0, 10) ?? '처음'} ~ ${rule.end_date?.slice(0, 10) ?? '계속'}`;
}

export function formatSlots(slots: TimeSlot[]): string {
  return slots.length === SLOT_OPTIONS.length ? '모든 시간대' : SLOT_OPTIONS.filter((slot) => slots.includes(slot.value)).map((slot) => slot.label).join('·');
}

export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${Number(month)}월`;
}

export function payRuleTitle(rule: PayRule): string {
  return rule.season_name || rule.memo || PAY_TYPE_LABELS[rule.pay_type];
}

// 400·404·409 는 서버 안내 문구를 그대로 보여 준다
export function apiErrorMessage(error: unknown, fallback: string): string {
  const response = axios.isAxiosError(error) ? error.response : undefined;
  return response && response.status < 500 && response.data?.message ? response.data.message : fallback;
}

export function apiErrorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error) ? error.response?.data?.error : undefined;
}
