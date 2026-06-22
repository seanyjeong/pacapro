import type { IncomeSelectOption } from './incomes-types';

export const CATEGORY_OPTIONS: IncomeSelectOption[] = [
  { value: 'clothing', label: '의류' },
  { value: 'shoes', label: '신발' },
  { value: 'equipment', label: '용품' },
  { value: 'beverage', label: '음료' },
  { value: 'snack', label: '간식' },
  { value: 'other', label: '기타' },
];

export const PAYMENT_METHOD_OPTIONS: IncomeSelectOption[] = [
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'transfer', label: '계좌이체' },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label])
);

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '현금',
  card: '카드',
  transfer: '계좌이체',
  account: '계좌이체',
};
