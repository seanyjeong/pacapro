/**
 * Early Pay Modal — 단월 미리 납부 (원장용)
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Banknote, Loader2 } from 'lucide-react';
import { paymentsAPI } from '@/lib/api/payments';
import { toast } from 'sonner';
import { getKoreaDateText } from '@/lib/utils/lifecycle-billing';
import type { EarlyPayPreviewResponse } from '@/lib/types/payment';

interface EarlyPayModalProps {
  open: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  monthlyTuition: number;
  discountRate?: number;
  onSuccess: () => void | Promise<void>;
}

const PAYMENT_METHODS = [
  { value: 'account', label: '계좌이체' },
  { value: 'card', label: '카드' },
  { value: 'cash', label: '현금' },
  { value: 'other', label: '기타' },
] as const;

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` });
  }
  return options;
}

function defaultNextMonth(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function EarlyPayModal({
  open,
  onClose,
  studentId,
  studentName,
  monthlyTuition,
  onSuccess,
}: EarlyPayModalProps) {
  const [yearMonth, setYearMonth] = useState(defaultNextMonth);
  const [paymentMethod, setPaymentMethod] = useState<string>('account');
  const [paymentDate, setPaymentDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // 납부 금액은 서버 미리보기(실행과 같은 계산)로 — 일할·휴원 정산·크레딧·추가 금액이 있는 청구도 실제로 받을 금액이 보인다
  // (예전엔 화면에서 학원비 − 할인으로 계산해 375,000원·293,000원 청구를 450,000원으로 보였다)
  const [preview, setPreview] = useState<EarlyPayPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!open || !studentId || !yearMonth) return;
    let cancelled = false;
    setPreview(null);
    setFormError(null);
    setPreviewLoading(true);
    paymentsAPI.earlyPayPreview({ student_id: studentId, year_month: yearMonth }, { suppressErrorToast: true })
      .then((result) => { if (!cancelled) setPreview(result); })
      .catch(() => { if (!cancelled) setFormError('미리 납부 금액을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [open, studentId, yearMonth]);

  useEffect(() => {
    if (!open) return;
    setYearMonth(defaultNextMonth());
    setPaymentMethod('account');
    setPaymentDate(getKoreaDateText());
    setFormError(null);
    setSubmitting(false);
  }, [open]);

  const handleSubmit = async () => {
    if (!studentId || !yearMonth || !paymentMethod) {
      setFormError('청구 월과 납부 방법을 확인해주세요.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const result = await paymentsAPI.earlyPay({
        student_id: studentId,
        year_month: yearMonth,
        payment_method: paymentMethod as 'account' | 'card' | 'cash' | 'other',
        payment_date: paymentDate || undefined,
      });
      toast.success(result.message || '미리 납부가 완료되었습니다.');
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as { message?: string })?.message
        || '미리 납부를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-success" />
            다음 달 미리 받기
          </DialogTitle>
          <DialogDescription>
            {studentName} 학생의 지정 월 학원비를 청구 생성과 동시에 완납 처리합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="early-pay-month">청구 월</Label>
            <select
              id="early-pay-month"
              className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-muted px-3 py-2 text-sm" data-testid="early-pay-amounts">
            {previewLoading || !preview ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 금액 확인 중
              </div>
            ) : preview.status === 'already_paid' ? (
              <p className="text-muted-foreground">이 달은 이미 완납되어 있어요.</p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{preview.status === 'new' ? `월 학원비 ${monthlyTuition.toLocaleString()}원, 할인 반영` : '이 달 청구 금액'}</span>
                  <span>{preview.final_amount.toLocaleString()}원</span>
                </div>
                {preview.separately_priced && (
                  <p className="mt-1 text-[13px] text-muted-foreground">일할·휴원 정산 등으로 정해진 청구라 그 금액 그대로 받아요.</p>
                )}
                {preview.already_paid_amount > 0 && (
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">이미 낸 금액</span>
                    <span>-{preview.already_paid_amount.toLocaleString()}원</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between font-semibold">
                  <span>납부 금액</span>
                  <span className="text-success">{preview.received_amount.toLocaleString()}원</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="early-pay-method">납부 방법</Label>
            <select
              id="early-pay-method"
              className="h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="early-pay-date">납부일</Label>
            <Input
              id="early-pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || previewLoading || !preview || preview.status === 'already_paid'}>
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                처리 중
              </>
            ) : (
              '미리 납부 완료'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
