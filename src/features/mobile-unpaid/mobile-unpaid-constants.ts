import { Banknote, Building2, CreditCard } from 'lucide-react';
import type { MobileUnpaidPaymentMethod } from './mobile-unpaid-types';

export const MOBILE_UNPAID_MESSAGES = {
  load: '오늘 미납 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  monthLoad: '해당 월 미납 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  pay: '납부 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  noPhone: '연락처가 등록되어 있지 않습니다.',
};

export const MOBILE_UNPAID_PAYMENT_METHODS = [
  { value: 'card', label: '카드', icon: CreditCard },
  { value: 'account', label: '계좌', icon: Building2 },
  { value: 'cash', label: '현금', icon: Banknote },
] satisfies Array<{ value: MobileUnpaidPaymentMethod; label: string; icon: typeof CreditCard }>;
