import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { paymentsAPI } from '@/lib/api/payments';
import type { UnpaidPayment } from '@/lib/types/payment';
import { canEdit, canView, isOwner } from '@/lib/utils/permissions';
import { MOBILE_UNPAID_MESSAGES } from './mobile-unpaid-constants';
import type { MobileUnpaidPaymentMethod, MobileUnpaidPaySheetState } from './mobile-unpaid-types';
import {
  calculateUnpaidStats,
  filterUnpaidPayments,
  getContactPhone,
  getUnpaidAmount,
  toLocalDateStr,
} from './mobile-unpaid-utils';

export function useMobileUnpaidState() {
  const router = useRouter();
  const [payments, setPayments] = useState<UnpaidPayment[]>([]);
  const [dayName, setDayName] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [canViewAmount, setCanViewAmount] = useState(false);
  const [canMarkPaid, setCanMarkPaid] = useState(false);
  const [paySheet, setPaySheet] = useState<MobileUnpaidPaySheetState | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await paymentsAPI.getUnpaidTodayPayments({ suppressErrorToast: true });
      setPayments(response.payments || []);
      setDayName(response.day_name || '');
    } catch {
      setPayments([]);
      setDayName('');
      setLoadError(MOBILE_UNPAID_MESSAGES.load);
    } finally {
      setLoading(false);
    }
  }, []);

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
    setCanViewAmount(isOwner());
    setCanMarkPaid(canEdit('payments'));
  }, [router]);

  useEffect(() => {
    if (hasPermission) void loadPayments();
  }, [hasPermission, loadPayments]);

  const stats = useMemo(() => calculateUnpaidStats(payments), [payments]);
  const filteredPayments = useMemo(() => filterUnpaidPayments(payments, query), [payments, query]);

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
      toast.success(`${payment.student_name} 완납 처리되었습니다.`);
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
    setPaySheet,
    setPaymentMethod,
    setQuery,
    stats,
  };
}
