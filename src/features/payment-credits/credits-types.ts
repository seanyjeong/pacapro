import type { Credit } from '@/lib/types/payment';

export type CreditStatusFilter = 'all' | Credit['status'];
export type CreditTypeFilter = 'all' | Credit['credit_type'];

export interface CreditFilters {
  status: CreditStatusFilter;
  type: CreditTypeFilter;
}
