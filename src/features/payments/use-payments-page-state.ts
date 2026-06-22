'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Payment, PaymentFilters } from '@/lib/types/payment';
import { parseClassDays } from '@/lib/types/student';
import {
  getClassDaysForPaymentsPage,
  getPaymentsForPage,
  getStudentForCredit,
  recordQuickPayment,
  sendUnpaidNotifications,
} from './payments-page-api';
import type { CreditStudentInfo, PaymentsPageStateOptions } from './payments-types';
import {
  calculatePaymentSummary,
  createClassDaysMap,
  createInitialPaymentFilters,
  filterPayments,
  getSelectedYearMonth,
  toAmount,
  toCreditStudentInfo,
} from './payments-utils';

const LOAD_ERROR_MESSAGE = '학원비 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function usePaymentsPageState({ statusFromUrl, viewOnly }: PaymentsPageStateOptions) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filters, setFilters] = useState<PaymentFilters>(createInitialPaymentFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [markingPaymentId, setMarkingPaymentId] = useState<number | null>(null);
  const [todayUnpaidOnly, setTodayUnpaidOnly] = useState(false);
  const [studentClassDaysMap, setStudentClassDaysMap] = useState<Map<number, number[]>>(new Map());
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditStudentInfo, setCreditStudentInfo] = useState<CreditStudentInfo | null>(null);

  const remoteFilters = useMemo(
    () => ({
      year: filters.year,
      month: filters.month,
      payment_status: filters.payment_status,
      payment_type: filters.payment_type,
      include_previous_unpaid: filters.include_previous_unpaid,
    }),
    [filters.year, filters.month, filters.payment_status, filters.payment_type, filters.include_previous_unpaid]
  );

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

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayments(await getPaymentsForPage(remoteFilters));
    } catch {
      console.error('Payments page data load failed');
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [remoteFilters]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (initialFiltersApplied) return;
    if (statusFromUrl === 'unpaid') {
      updateFilters({ payment_status: 'pending' });
    }
    setInitialFiltersApplied(true);
  }, [initialFiltersApplied, statusFromUrl, updateFilters]);

  useEffect(() => {
    let cancelled = false;
    getClassDaysForPaymentsPage()
      .then((response) => {
        if (!cancelled) setStudentClassDaysMap(createClassDaysMap(response));
      })
      .catch(() => {
        console.error('Payment class-days load failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedYearMonth = getSelectedYearMonth(filters);
  const filteredPayments = useMemo(
    () => filterPayments(payments, filters, viewOnly, todayUnpaidOnly, studentClassDaysMap),
    [payments, filters, viewOnly, todayUnpaidOnly, studentClassDaysMap]
  );
  const summary = useMemo(() => calculatePaymentSummary(filteredPayments, selectedYearMonth), [filteredPayments, selectedYearMonth]);

  const resetPageFilters = () => {
    setTodayUnpaidOnly(false);
    setFilters(createInitialPaymentFilters());
  };

  const sendUnpaid = async () => {
    const unpaidList = filteredPayments.filter((payment) => payment.payment_status !== 'paid');
    if (unpaidList.length === 0) {
      toast.error('미납자가 없습니다.');
      return;
    }
    if (!window.confirm(`미납자 ${unpaidList.length}명에게 알림톡을 발송하시겠습니까?`)) return;

    setSendingNotification(true);
    try {
      const result = await sendUnpaidNotifications(filters.year || new Date().getFullYear(), filters.month || new Date().getMonth() + 1);
      toast.success(`알림 발송 완료: ${result.sent}명 성공, ${result.failed}명 실패`);
    } catch {
      console.error('Unpaid notification send failed');
      toast.error('미납 알림을 발송하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSendingNotification(false);
    }
  };

  const openCreditModal = async (payment: Payment) => {
    try {
      const result = await getStudentForCredit(payment.student_id);
      const student = result.student;
      setCreditStudentInfo(
        toCreditStudentInfo(
          payment,
          toAmount(student.monthly_tuition),
          student.weekly_count || 2,
          parseClassDays(student.class_days || [])
        )
      );
      setCreditModalOpen(true);
    } catch {
      console.error('Credit student load failed');
      toast.error('학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const markPayment = async (payment: Payment, method: 'account' | 'card' | 'cash' | 'other') => {
    setMarkingPaymentId(payment.id);
    try {
      await recordQuickPayment(payment.id, {
        paid_amount: toAmount(payment.final_amount) - toAmount(payment.paid_amount),
        payment_method: method,
        payment_date: new Date().toISOString().split('T')[0],
        notes: `빠른 납부 처리 (${method})`,
      });
      toast.success(`${payment.student_name}님의 학원비가 납부 처리되었습니다.`);
      void loadPayments();
    } catch {
      console.error('Quick payment mark failed');
      toast.error('납부 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setMarkingPaymentId(null);
    }
  };

  return {
    payments,
    filteredPayments,
    summary,
    filters,
    loading,
    error,
    sendingNotification,
    markingPaymentId,
    todayUnpaidOnly,
    calculatorOpen,
    creditModalOpen,
    creditStudentInfo,
    setCalculatorOpen,
    setCreditModalOpen,
    setCreditStudentInfo,
    setTodayUnpaidOnly,
    updateFilters,
    resetPageFilters,
    reload: loadPayments,
    sendUnpaid,
    openCreditModal,
    markPayment,
  };
}
