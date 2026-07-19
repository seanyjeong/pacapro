import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { paymentsAPI } from '@/lib/api/payments';
import type { UnpaidPayment } from '@/lib/types/payment';
import { canEdit, canView } from '@/lib/utils/permissions';
import { MOBILE_UNPAID_MESSAGES } from './mobile-unpaid-constants';
import {
  filterUnpaidPaymentsByMonth,
  getCurrentYearMonth,
} from './mobile-unpaid-month.mjs';
import type {
  MobileUnpaidPaymentMethod,
  MobileUnpaidPaySheetState,
  MobileUnpaidScope,
} from './mobile-unpaid-types';
import {
  calculateUnpaidStats,
  filterUnpaidPayments,
  getContactPhone,
  getDisplayStudentName,
  getUnpaidAmount,
  toLocalDateStr,
} from './mobile-unpaid-utils';

export function useMobileUnpaidState() {
  const router = useRouter();
  const [payments, setPayments] = useState<UnpaidPayment[]>([]);
  const [dayName, setDayName] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<MobileUnpaidScope>('today');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [canViewAmount, setCanViewAmount] = useState(false);
  const [canMarkPaid, setCanMarkPaid] = useState(false);
  const [paySheet, setPaySheet] = useState<MobileUnpaidPaySheetState | null>(null);
  const [processing, setProcessing] = useState(false);
  const loadRequestId = useRef(0);

  const loadPayments = useCallback(async () => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setLoading(true);
    setLoadError(null);
    try {
      if (scope === 'month') {
        const response = await paymentsAPI.getUnpaidPayments({ suppressErrorToast: true });
        if (requestId !== loadRequestId.current) return;
        setPayments(response.payments || []);
        setDayName('');
      } else {
        const response = await paymentsAPI.getUnpaidTodayPayments({ suppressErrorToast: true });
        if (requestId !== loadRequestId.current) return;
        setPayments(response.payments || []);
        setDayName(response.day_name || '');
      }
    } catch {
      if (requestId !== loadRequestId.current) return;
      setPayments([]);
      setDayName('');
      setLoadError(scope === 'month' ? MOBILE_UNPAID_MESSAGES.monthLoad : MOBILE_UNPAID_MESSAGES.load);
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (!canView('payments')) {
      router.push('/m');
      return;
    }
    setHasPermission(true);
    setCanViewAmount(canView('payments'));
    setCanMarkPaid(canEdit('payments'));
  }, [router]);

  useEffect(() => {
    if (hasPermission) void loadPayments();
  }, [hasPermission, loadPayments]);

  const scopedPayments = useMemo(
    () => (scope === 'month' ? filterUnpaidPaymentsByMonth(payments, selectedMonth) : payments),
    [payments, scope, selectedMonth]
  );
  const stats = useMemo(() => calculateUnpaidStats(scopedPayments), [scopedPayments]);
  const filteredPayments = useMemo(() => filterUnpaidPayments(scopedPayments, query), [scopedPayments, query]);

  const changeScope = (nextScope: MobileUnpaidScope) => {
    if (nextScope === scope) return;
    setLoading(true);
    setScope(nextScope);
  };

  const openPaySheet = (payment: UnpaidPayment) => {
    if (!canMarkPaid || processing) return;
    setPaySheet({ payment, method: 'card' });
  };

  const setPaymentMethod = (method: MobileUnpaidPaymentMethod) => {
    setPaySheet((current) => (current ? { ...current, method } : current));
  };

  const callPaymentContact = (payment: UnpaidPayment) => {
    const phone = getContactPhone(payment);
    if (!phone) {
      toast.error(MOBILE_UNPAID_MESSAGES.noPhone);
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  const confirmPayment = async () => {
    if (!paySheet || processing) return;
    const { payment, method } = paySheet;

    setProcessing(true);
    try {
      await paymentsAPI.recordPayment(
        payment.id,
        {
          paid_amount: getUnpaidAmount(payment),
          payment_method: method,
          payment_date: toLocalDateStr(new Date()),
        },
        { suppressErrorToast: true }
      );
      toast.success(`${getDisplayStudentName(payment)} 완납 처리되었습니다.`);
      setPaySheet(null);
      await loadPayments();
    } catch {
      toast.error(MOBILE_UNPAID_MESSAGES.pay);
    } finally {
      setProcessing(false);
    }
  };

  return {
    callPaymentContact,
    canMarkPaid,
    canViewAmount,
    confirmPayment,
    dayName,
    filteredPayments,
    hasPermission,
    loadError,
    loading,
    openPaySheet,
    paySheet,
    processing,
    query,
    reload: loadPayments,
    router,
    scope,
    selectedMonth,
    setPaySheet,
    setPaymentMethod,
    setQuery,
    setScope: changeScope,
    setSelectedMonth,
    stats,
  };
}
