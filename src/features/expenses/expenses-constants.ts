import type { ExpenseSelectOption } from './expenses-types';

export const REFUND_PENDING_CATEGORY = '환불(대기)';

export const EXPENSE_CATEGORY_OPTIONS: ExpenseSelectOption[] = [
  { value: 'utilities', label: '공과금' },
  { value: 'rent', label: '임대료' },
  { value: 'supplies', label: '소모품' },
  { value: 'marketing', label: '홍보비' },
  { value: 'salary', label: '급여' },
  { value: 'refund', label: '환불' },
  { value: 'other', label: '기타' },
];

export const PAYMENT_METHOD_OPTIONS: ExpenseSelectOption[] = [
  { value: 'account', label: '계좌이체' },
  { value: 'card', label: '카드' },
  { value: 'cash', label: '현금' },
  { value: 'other', label: '기타' },
];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(EXPENSE_CATEGORY_OPTIONS.map((option) => [option.value, option.label])),
  환불: '환불',
  [REFUND_PENDING_CATEGORY]: REFUND_PENDING_CATEGORY,
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label])
);
