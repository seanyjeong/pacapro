'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Payment, PaymentRecordData } from '@/lib/types/payment';
import {
  deletePaymentForDetail,
  getPaymentForDetail,
  getPaymentFromResponse,
  recordPaymentForDetail,
  updatePaymentPaidDate,
} from './payment-detail-api';

const LOAD_ERROR_MESSAGE = '학원비 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function usePaymentDetailState(paymentId: number) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPayment = useCallback(async () => {
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      setPayment(null);
      setError('학원비 정보를 찾을 수 없습니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getPaymentForDetail(paymentId);
      setPayment(getPaymentFromResponse(response));
    } catch {
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    void loadPayment();
  }, [loadPayment]);

  const recordPayment = async (data: PaymentRecordData) => {
    try {
      await recordPaymentForDetail(paymentId, data);
      toast.success('납부가 기록되었습니다.');
      await loadPayment();
    } catch {
      toast.error('납부 기록을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      throw new Error('payment record failed');
    }
  };

  const updatePaidDate = async (paidDate: string) => {
    try {
      await updatePaymentPaidDate(paymentId, { paid_date: paidDate });
      toast.success('납부일이 수정되었습니다.');
      await loadPayment();
    } catch {
      toast.error('납부일을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.');
      throw new Error('paid date update failed');
    }
  };

  const deletePayment = async (onDeleted: () => void) => {
    if (!window.confirm('이 학원비 청구를 삭제하시겠습니까? 삭제 후에는 목록에서 확인할 수 없습니다.')) return;
    setDeleting(true);
    try {
      await deletePaymentForDetail(paymentId);
      toast.success('학원비 청구가 삭제되었습니다.');
      onDeleted();
    } catch {
      toast.error('학원비 청구를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setDeleting(false);
    }
  };

  return {
    payment,
    loading,
    error,
    showRecordModal,
    deleting,
    setShowRecordModal,
    reload: loadPayment,
    recordPayment,
    updatePaidDate,
    deletePayment,
  };
}
