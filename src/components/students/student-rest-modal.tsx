'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Loader2, X } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import { useLifecycleBillingPreview } from '@/hooks/use-lifecycle-billing-preview';
import { LifecycleBillingPreviewPanel, LifecycleBillingResultPanel } from './lifecycle-billing-preview';
import type { LifecycleCreditType } from '@/lib/types/lifecycle-billing';
import { LIFECYCLE_CREDIT_CHOICES } from '@/constants/lifecycle-billing';
import { describePauseBillingResult, describeRestCreditResult, formatLifecycleMoney, getKoreaDateText, getLifecycleErrorMessage } from '@/lib/utils/lifecycle-billing';

interface StudentRestModalProps {
  open: boolean;
  onClose: () => void;
  student: { id: number; name: string; monthly_tuition: string; weekly_count: number };
  onSuccess: () => void;
}

export function StudentRestModal({ open, onClose, student, onSuccess }: StudentRestModalProps) {
  const today = getKoreaDateText();
  const queryClient = useQueryClient();
  const [restStartDate, setRestStartDate] = useState(today);
  const [restEndDate, setRestEndDate] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(true);
  const [restReason, setRestReason] = useState('');
  const [creditType, setCreditType] = useState<LifecycleCreditType>('none');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<Awaited<ReturnType<typeof studentsAPI.processRest>> | null>(null);
  const preview = useLifecycleBillingPreview({ studentId: student.id, action: 'pause', date: restStartDate,
    enabled: open && !completed, restEndDate: isIndefinite ? null : restEndDate || null, creditType });
  const credit = preview.data?.credit;

  useEffect(() => {
    if (!open) return;
    setRestStartDate(today); setRestEndDate(''); setIsIndefinite(true);
    setRestReason(''); setCreditType('none'); setError(''); setCompleted(null);
  }, [open, today]);

  const handleSubmit = async () => {
    if (!restStartDate || !preview.ready) {
      setError(preview.error || '학원비와 선택한 크레딧 금액을 확인한 뒤 휴원 처리해주세요.');
      return;
    }
    if (!isIndefinite && (!restEndDate || restEndDate < restStartDate)) {
      setError('휴원 종료일은 시작일 이후로 선택해주세요.');
      return;
    }
    setSubmitting(true); setError('');
    try {
      const response = await studentsAPI.processRest(student.id, {
        rest_start_date: restStartDate, rest_end_date: isIndefinite ? null : restEndDate || null,
        rest_reason: restReason || undefined, credit_type: creditType,
        billing_preview_hash: preview.data?.preview_hash,
      }, { suppressErrorToast: true });
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      const creditText = response.restCredit
        ? ` ${describeRestCreditResult(response.restCredit)}.` : '';
      toast.success('휴원 처리가 완료되었습니다.', { description: describePauseBillingResult(response.unpaidAdjustment) + creditText });
      setCompleted(response);
    } catch (err: unknown) {
      setError(getLifecycleErrorMessage(err, '휴원 처리를 완료하지 못했습니다. 변경 내역을 확인해주세요.'));
      preview.retry();
    } finally { setSubmitting(false); }
  };

  const finish = () => { onSuccess(); onClose(); };
  if (!open) return null;
  const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <AlertDialog open={open} onOpenChange={next => { if (!next && !submitting) { if (completed) finish(); else onClose(); } }}>
      <AlertDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <AlertDialogTitle>{completed ? '휴원 처리 결과' : '휴원 처리'}</AlertDialogTitle>
            <Button type="button" variant="ghost" size="icon" onClick={completed ? finish : onClose} disabled={submitting} aria-label="휴원 창 닫기"><X className="h-4 w-4" /></Button>
          </div>
          <AlertDialogDescription>{student.name} 학생 · 월 수업료 {formatLifecycleMoney(student.monthly_tuition)}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-5">
          {completed ? (
            <>
              <LifecycleBillingResultPanel title="실제 학원비 처리 결과" result={completed.unpaidAdjustment} />
              {completed.restCredit ? <p className="text-sm tabular-nums">{describeRestCreditResult(completed.restCredit)}</p> : null}
              <AlertDialogFooter><Button type="button" onClick={finish}>확인하고 닫기</Button></AlertDialogFooter>
            </>
          ) : (
            <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">휴원 시작일
              <input aria-label="휴원 시작일" type="date" className={inputClass} value={restStartDate} disabled={submitting}
                onChange={event => setRestStartDate(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">휴원 종료일
              <input aria-label="휴원 종료일" type="date" className={inputClass} value={restEndDate} min={restStartDate}
                disabled={isIndefinite || submitting} onChange={event => setRestEndDate(event.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isIndefinite} disabled={submitting} onChange={event => { setIsIndefinite(event.target.checked); if (event.target.checked) setRestEndDate(''); }} />무기한 휴원
          </label>
          <label className="block space-y-1 text-sm">휴원 사유
            <input aria-label="휴원 사유" className={inputClass} maxLength={255} value={restReason} disabled={submitting}
              onChange={event => setRestReason(event.target.value)} placeholder="예: 개인 사정, 부상" />
          </label>
          <LifecycleBillingPreviewPanel preview={preview} />
          <fieldset className="space-y-2" disabled={submitting}>
            <legend className="mb-2 text-sm font-semibold">이월·환불 크레딧 선택</legend>
            {LIFECYCLE_CREDIT_CHOICES.map(choice => (
              <label key={choice.value} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${creditType === choice.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="rest-credit-type" value={choice.value} checked={creditType === choice.value}
                  onChange={() => setCreditType(choice.value)} className="mt-1 accent-primary" />
                <span className="min-w-0"><span className="block text-sm font-medium">{choice.label}</span><span className="block text-xs text-muted-foreground">{choice.detail}</span></span>
              </label>
            ))}
            {creditType !== 'none' && preview.ready ? (
              <p className="text-sm tabular-nums" role="status">{credit
                ? credit.existing ? `기존 크레딧: ${formatLifecycleMoney(credit.credit_amount)}, 잔액 ${formatLifecycleMoney(credit.remaining_amount)}`
                  : `선택한 크레딧: ${formatLifecycleMoney(credit.credit_amount)} (${credit.rest_days}일)`
                : '이번 처리에서 생성할 크레딧이 없습니다.'}</p>
            ) : null}
          </fieldset>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting || !preview.ready}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{submitting ? '처리 중...' : '확인한 금액으로 휴원 처리'}
            </Button>
          </AlertDialogFooter>
            </>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
