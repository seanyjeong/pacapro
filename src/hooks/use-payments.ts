/**
 * Custom Hooks for Payment Management
 * 학원비 관리 커스텀 훅
 */

import { useState, useEffect } from 'react';
import { paymentsAPI } from '@/lib/api/payments';
import type {
  Payment,
  UnpaidPayment,
  PaymentFilters,
  PaymentStats,
} from '@/lib/types/payment';

/**
 * 학원비 목록 관리 훅
 * @param initialFilters 초기 필터 값
 */
export function usePayments(initialFilters?: PaymentFilters) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PaymentFilters>(initialFilters || {});

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentsAPI.getPayments(filters);
      setPayments(data.payments);
    } catch (err: any) {
      console.error('Failed to load payments:', err);
      setError(err.response?.data?.message || '학원비 목록을 불러오는데 실패했습니다.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [JSON.stringify(filters)]);

  const updateFilters = (newFilters: Partial<PaymentFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({});
  };

  return {
    payments,
    loading,
    error,
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    reload: loadPayments,
  };
}

/**
 * 학원비 상세 정보 관리 훅
 * @param id 학원비 ID
 */
export function usePayment(id: number) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayment = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentsAPI.getPayment(id);
      setPayment(data.payment);
    } catch (err: any) {
      console.error('Failed to load payment:', err);
      setError(err.response?.data?.message || '학원비 정보를 불러오는데 실패했습니다.');
      setPayment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadPayment();
    }
  }, [id]);

  return {
    payment,
    loading,
    error,
    reload: loadPayment,
  };
}

/**
 * 미납 학원비 관리 훅
 */
export function useUnpaidPayments() {
  const [unpaidPayments, setUnpaidPayments] = useState<UnpaidPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUnpaidPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentsAPI.getUnpaidPayments();
      setUnpaidPayments(data.payments);
    } catch (err: any) {
      console.error('Failed to load unpaid payments:', err);
      setError(err.response?.data?.message || '미납 학원비를 불러오는데 실패했습니다.');
      setUnpaidPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnpaidPayments();
  }, []);

  return {
    unpaidPayments,
    loading,
    error,
    reload: loadUnpaidPayments,
  };
}

/**
 * 학원비 통계 관리 훅
 * @param year 연도
 * @param month 월
 */
export function usePaymentStats(year?: number, month?: number) {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await paymentsAPI.getPaymentStats(year, month);
      setStats(data.stats);
    } catch (err: any) {
      console.error('Failed to load payment stats:', err);
      setError(err.response?.data?.message || '통계를 불러오는데 실패했습니다.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [year, month]);

  return {
    stats,
    loading,
    error,
    reload: loadStats,
  };
}
