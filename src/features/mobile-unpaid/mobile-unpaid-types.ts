import type { UnpaidPayment } from '@/lib/types/payment';

export type MobileUnpaidPaymentMethod = 'card' | 'account' | 'cash';

export interface MobileUnpaidStats {
  count: number;
  totalUnpaid: number;
  partialCount: number;
  overdueCount: number;
}

export interface MobileUnpaidPaySheetState {
  payment: UnpaidPayment;
  method: MobileUnpaidPaymentMethod;
}
