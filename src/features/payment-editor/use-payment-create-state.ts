'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { PaymentFormData } from '@/lib/types/payment';
import { createPaymentFromEditor, getActiveStudentsForPaymentForm } from './payment-editor-api';
import type { PaymentEditorStateBase } from './payment-editor-types';

const LOAD_ERROR_MESSAGE = '학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function usePaymentCreateState(): PaymentEditorStateBase & {
  reload: () => Promise<void>;
  submitPayment: (data: PaymentFormData, onCreated: () => void) => Promise<void>;
} {
  const [state, setState] = useState<PaymentEditorStateBase>({ students: [], loading: true, error: null, saving: false });

  const loadStudents = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const students = await getActiveStudentsForPaymentForm();
      setState((previous) => ({ ...previous, students }));
    } catch {
      setState((previous) => ({ ...previous, error: LOAD_ERROR_MESSAGE }));
    } finally {
      setState((previous) => ({ ...previous, loading: false }));
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const submitPayment = async (data: PaymentFormData, onCreated: () => void) => {
    setState((previous) => ({ ...previous, saving: true }));
    try {
      await createPaymentFromEditor(data);
      toast.success('학원비가 청구되었습니다.');
      onCreated();
    } catch {
      toast.error('학원비 청구를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setState((previous) => ({ ...previous, saving: false }));
    }
  };

  return { ...state, reload: loadStudents, submitPayment };
}
