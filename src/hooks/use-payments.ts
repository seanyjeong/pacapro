/**
 * Custom Hooks for Payment Management
 * 학원비 관리 커스텀 훅 - React Query 기반 (backward-compatible interface)
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsAPI } from '@/lib/api/payments';
import type {
  Payment,
  UnpaidPayment,
  PaymentFilters,
  PaymentStats,
  PaymentFormData,
} from '@/lib/types/payment';
import { toast } from 'sonner';

const QUERY_KEYS = {
  payments: (filters?: PaymentFilters) => ['payments', filters] as const,
  payment: (id: number) => ['payments', id] as const,
  unpaid: () => ['payments', 'unpaid'] as const,
  stats: (year?: number, month?: number) => ['payments', 'stats', year, month] as const,
};

/**
 * 학원비 목록 조회 훅
 */
export function usePayments(initialFilters?: PaymentFilters) {
  const [filters, setFilters] = useState<PaymentFilters>(initialFilters || {});

  const query = useQuery({
    queryKey: QUERY_KEYS.payments(filters),
    queryFn: async () => {
      const data = await paymentsAPI.getPayments(filters);
      return data.payments as Payment[];
    },
  });

  const updateFilters = useCallback((newFilters: Partial<PaymentFilters>) => {
    setFilters((prev) => {
      const merged = { ...prev, ...newFilters };
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
 * 학원비 상세 정보 조회 훅
 */
export function usePayment(id: number) {
  const query = useQuery({
    queryKey: QUERY_KEYS.payment(id),
    queryFn: async () => {
      const data = await paymentsAPI.getPayment(id);
      return data.payment as Payment;
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
 * 미납 학원비 조회 훅
 */
export function useUnpaidPayments() {
  const query = useQuery({
    queryKey: QUERY_KEYS.unpaid(),
    queryFn: async () => {
      const data = await paymentsAPI.getUnpaidPayments();
      return data.payments as UnpaidPayment[];
    },
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
 * 학원비 통계 조회 훅
 */
export function usePaymentStats(year?: number, month?: number) {
  const query = useQuery({
    queryKey: QUERY_KEYS.stats(year, month),
    queryFn: async () => {
      const data = await paymentsAPI.getPaymentStats(year, month);
      return data.stats as PaymentStats;
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
 * 학원비 등록 뮤테이션 훅
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
 * 학원비 수정 뮤테이션 훅
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
 * 학원비 삭제 뮤테이션 훅
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
