'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Payment } from '@/lib/types/payment';
import type { PaymentFormData } from '@/lib/types/payment';
import {
  getActiveStudentsForPaymentForm,
  getPaymentForEditor,
  getPaymentFromEditorResponse,
  updatePaymentFromEditor,
} from './payment-editor-api';
import { ensurePaymentStudent } from './payment-editor-utils';
import type { PaymentEditorStateBase } from './payment-editor-types';

const LOAD_ERROR_MESSAGE = '학원비 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

interface PaymentEditState extends PaymentEditorStateBase {
  payment: Payment | null;
  reload: () => Promise<void>;
  submitPayment: (data: PaymentFormData, onUpdated: () => void) => Promise<void>;
}

export function usePaymentEditState(paymentId: number): PaymentEditState {
  const [state, setState] = useState<PaymentEditorStateBase & { payment: Payment | null }>({
    students: [],
    payment: null,
    loading: true,
    error: null,
    saving: false,
  });

  const loadData = useCallback(async () => {
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      setState((previous) => ({ ...previous, loading: false, error: '학원비 정보를 찾을 수 없습니다.' }));
      return;
    }
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const [students, paymentResponse] = await Promise.all([
        getActiveStudentsForPaymentForm(),
        getPaymentForEditor(paymentId),
      ]);
      const payment = getPaymentFromEditorResponse(paymentResponse);
      setState((previous) => ({ ...previous, students: ensurePaymentStudent(students, payment), payment }));
    } catch {
      setState((previous) => ({ ...previous, error: LOAD_ERROR_MESSAGE }));
    } finally {
      setState((previous) => ({ ...previous, loading: false }));
    }
  }, [paymentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitPayment = async (data: PaymentFormData, onUpdated: () => void) => {
    setState((previous) => ({ ...previous, saving: true }));
    try {
      await updatePaymentFromEditor(paymentId, data);
      toast.success('학원비가 수정되었습니다.');
      onUpdated();
    } catch {
      toast.error('학원비 수정을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setState((previous) => ({ ...previous, saving: false }));
    }
  };

  return { ...state, reload: loadData, submitPayment };
}
