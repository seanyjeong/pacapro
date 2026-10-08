'use client';

import { useEffect, useState } from 'react';
import { studentsAPI } from '@/lib/api/students';
import type { LifecycleBillingAction, LifecycleBillingPreview, LifecycleCreditType } from '@/lib/types/lifecycle-billing';
import { getLifecycleErrorMessage } from '@/lib/utils/lifecycle-billing';

export interface LifecycleBillingPreviewState {
  data: LifecycleBillingPreview | null;
  loading: boolean;
  error: string;
  ready: boolean;
  retry: () => void;
}

export function useLifecycleBillingPreview({ studentId, action, date, enabled, restEndDate, creditType }: {
  studentId?: number;
  action: LifecycleBillingAction;
  date: string;
  enabled: boolean;
  restEndDate?: string | null;
  creditType?: LifecycleCreditType;
}): LifecycleBillingPreviewState {
  const [revision, setRevision] = useState(0);
  const key = `${studentId}:${action}:${date}:${restEndDate ?? ''}:${creditType ?? ''}:${revision}`;
  const [result, setResult] = useState<{ key: string; data: LifecycleBillingPreview | null; error: string; loading: boolean }>(
    { key: '', data: null, error: '', loading: false },
  );
  useEffect(() => {
    if (!enabled) {
      setResult({ key: '', data: null, error: '', loading: false });
      return;
    }
    let current = true;
    if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setResult({ key, data: null, loading: false, error: '처리 날짜를 입력해 학원비를 확인해주세요.' });
      return;
    }
    setResult({ key, data: null, loading: true, error: '' });
    studentsAPI.previewLifecycleBilling(studentId, { action, date,
      ...(creditType ? { rest_end_date: restEndDate ?? null, credit_type: creditType } : {}),
    }, { suppressErrorToast: true })
      .then(data => {
        if (data.student_id !== studentId || data.action !== action || data.date !== date
            || !data.preview_hash || data.readonly !== true) throw new Error('Invalid billing preview');
        if (current) setResult({ key, data, loading: false, error: '' });
      })
      .catch(error => {
        if (current) setResult({ key, data: null, loading: false,
          error: getLifecycleErrorMessage(error, '학원비 미리보기를 불러오지 못했습니다. 다시 확인한 뒤 저장해주세요.') });
      });
    return () => { current = false; };
  }, [action, creditType, date, enabled, key, restEndDate, revision, studentId]);

  const matches = enabled && result.key === key;
  const data = matches ? result.data : null;
  return { data, loading: enabled && (!matches || result.loading),
    error: matches ? result.error : '', ready: Boolean(data && !result.loading && !result.error),
    retry: () => setRevision(value => value + 1) };
}
