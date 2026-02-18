/**
 * Custom Hooks for Payment Management
 * Aligned with FastAPI backend
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsAPI } from '@/lib/api/payments';
import type {
  Payment,
  PaymentFilters,
  PaymentStatsResponse,
  PaymentFormData,
} from '@/lib/types/payment';
import { toast } from 'sonner';

const QUERY_KEYS = {
  payments: (filters?: PaymentFilters) => ['payments', filters] as const,
  payment: (id: number) => ['payments', id] as const,
  unpaid: (yearMonth: string) => ['payments', 'unpaid', yearMonth] as const,
  stats: (yearMonth?: string) => ['payments', 'stats', yearMonth] as const,
};

// Helper: convert year+month to year_month string
function toYearMonth(year?: number, month?: number): string | undefined {
  if (!year || !month) return undefined;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Payment list hook
 * Accepts legacy { year, month } or new { year_month } filters
 */
export function usePayments(initialFilters?: PaymentFilters & { year?: number; month?: number; include_previous_unpaid?: boolean }) {
  // Convert legacy year+month to year_month
  const normalizeFilters = useCallback((f: typeof initialFilters): PaymentFilters => {
    if (!f) return {};
    const { year, month, include_previous_unpaid, ...rest } = f as PaymentFilters & { year?: number; month?: number; include_previous_unpaid?: boolean };
    const yearMonth = rest.year_month ?? toYearMonth(year, month);
    return {
      ...rest,
      ...(yearMonth ? { year_month: yearMonth } : {}),
    };
  }, []);

  const [filters, setFilters] = useState<PaymentFilters>(normalizeFilters(initialFilters));

  const query = useQuery({
    queryKey: QUERY_KEYS.payments(filters),
    queryFn: async () => {
      // Backend returns Payment[] directly
      const data = await paymentsAPI.getPayments(filters);
      return Array.isArray(data) ? data : (data as unknown as { payments?: Payment[] }).payments ?? [];
    },
  });

  const updateFilters = useCallback((newFilters: Partial<PaymentFilters & { year?: number; month?: number }>) => {
    setFilters((prev) => {
      const { year, month, ...rest } = newFilters as Partial<PaymentFilters> & { year?: number; month?: number };
      const yearMonth = rest.year_month ?? toYearMonth(year, month);
      const merged = { ...prev, ...rest, ...(yearMonth ? { year_month: yearMonth } : {}) };
      Object.keys(merged).forEach(key => {
        if (merged[key as keyof PaymentFilters] === undefined) {
          delete merged[key as keyof PaymentFilters];
        }
      });
      return merged;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    payments: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    reload,
  };
}

/**
 * Single payment detail hook
 */
export function usePayment(id: number) {
  const query = useQuery({
    queryKey: QUERY_KEYS.payment(id),
    queryFn: async () => {
      // Backend returns Payment directly
      return await paymentsAPI.getPayment(id);
    },
    enabled: !!id,
  });

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    payment: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    reload,
  };
}

/**
 * Unpaid payments hook
 */
export function useUnpaidPayments(yearMonth?: string) {
  const ym = yearMonth ?? toYearMonth(new Date().getFullYear(), new Date().getMonth() + 1) ?? '';

  const query = useQuery({
    queryKey: QUERY_KEYS.unpaid(ym),
    queryFn: async () => {
      // Backend returns Payment[] directly
      return await paymentsAPI.getUnpaidPayments(ym);
    },
    enabled: !!ym,
  });

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    unpaidPayments: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    reload,
  };
}

/**
 * Payment stats hook
 */
export function usePaymentStats(year?: number, month?: number) {
  const yearMonth = toYearMonth(year, month);

  const query = useQuery({
    queryKey: QUERY_KEYS.stats(yearMonth),
    queryFn: async () => {
      // Backend returns stats directly
      return await paymentsAPI.getPaymentStats(yearMonth);
    },
  });

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    stats: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    reload,
  };
}

/**
 * Create payment mutation
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PaymentFormData) => paymentsAPI.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('학원비가 등록되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`학원비 등록 실패: ${error.message}`);
    },
  });
}

/**
 * Update payment mutation
 */
export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PaymentFormData> }) =>
      paymentsAPI.updatePayment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payment(variables.id) });
      toast.success('학원비 정보가 수정되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`학원비 수정 실패: ${error.message}`);
    },
  });
}

/**
 * Delete payment mutation
 */
export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => paymentsAPI.deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('학원비가 삭제되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`학원비 삭제 실패: ${error.message}`);
    },
  });
}
