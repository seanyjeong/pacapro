'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Payment, PaymentFilters } from '@/lib/types/payment';
import { calculatePaymentSummary, getSelectedYearMonth } from '@/features/payments/payments-utils';
import { getPaymentsForPage, recordQuickPayment } from '@/features/payments/payments-page-api';
import {
  createTabletPaymentFilters,
  filterTabletPayments,
  getRemainingAmount,
  parseStudentId,
  shiftPaymentMonth,
} from './tablet-payments-utils';

const LOAD_ERROR_MESSAGE = '결제 정보를 불러오지 못했습니다';
const LOAD_ERROR_DETAIL = '잠시 후 다시 시도해주세요.';

interface UseTabletPaymentsStateOptions {
  studentIdParam: string | null;
  statusFromUrl: string | null;
}

export function useTabletPaymentsState({ studentIdParam, statusFromUrl }: UseTabletPaymentsStateOptions) {
  const studentId = parseStudentId(studentIdParam);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filters, setFilters] = useState<PaymentFilters>(() => createTabletPaymentFilters(studentId, statusFromUrl));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingPaymentId, setMarkingPaymentId] = useState<number | null>(null);

  useEffect(() => {
    setFilters((prev) => {
      const nextStatus = statusFromUrl === 'unpaid' ? 'pending' : prev.payment_status;
      if (prev.student_id === studentId && prev.payment_status === nextStatus) return prev;
      return {
        ...prev,
        student_id: studentId,
        payment_status: nextStatus,
      };
    });
  }, [statusFromUrl, studentId]);

  const remoteFilters = useMemo(
    () => ({
      year: filters.year,
      month: filters.month,
      student_id: filters.student_id,
      payment_status: filters.payment_status,
      payment_type: filters.payment_type,
      include_previous_unpaid: filters.include_previous_unpaid,
    }),
    [
      filters.include_previous_unpaid,
      filters.month,
      filters.payment_status,
      filters.payment_type,
      filters.student_id,
      filters.year,
    ]
  );

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayments(await getPaymentsForPage(remoteFilters));
    } catch {
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [remoteFilters]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const updateFilters = useCallback((newFilters: Partial<PaymentFilters>) => {
    setFilters((prev) => {
      const merged = { ...prev, ...newFilters };
      Object.keys(merged).forEach((key) => {
        if (merged[key as keyof PaymentFilters] === undefined) {
          delete merged[key as keyof PaymentFilters];
        }
      });
      return merged;
    });
  }, []);

  const changeMonth = (delta: number) => {
    updateFilters(shiftPaymentMonth(filters, delta));
  };

  const visiblePayments = useMemo(() => filterTabletPayments(payments, filters), [filters, payments]);
  const selectedYearMonth = getSelectedYearMonth(filters);
  const summary = useMemo(() => calculatePaymentSummary(visiblePayments, selectedYearMonth), [selectedYearMonth, visiblePayments]);
  const studentName = useMemo(() => {
    if (!studentId) return null;
    return payments.find((payment) => payment.student_id === studentId)?.student_name || null;
  }, [payments, studentId]);

  const markPayment = async (payment: Payment, method: 'account' | 'card' | 'cash') => {
    setMarkingPaymentId(payment.id);
    try {
      await recordQuickPayment(payment.id, {
        paid_amount: getRemainingAmount(payment),
        payment_method: method,
        payment_date: new Date().toISOString().split('T')[0],
        notes: `태블릿 빠른 납부 처리 (${method})`,
      });
      toast.success(`${payment.student_name}님의 학원비가 납부 처리되었습니다.`);
      void loadPayments();
    } catch {
      toast.error('납부 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setMarkingPaymentId(null);
    }
  };

  return {
    error,
    errorDetail: LOAD_ERROR_DETAIL,
    filters,
    loading,
    markingPaymentId,
    payments,
    selectedYearMonth,
    studentId,
    studentName,
    summary,
    visiblePayments,
    changeMonth,
    markPayment,
    reload: loadPayments,
    updateFilters,
  };
}
