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

function truncateToThousands(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

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
  discountRate = 0,
  onSuccess,
}: EarlyPayModalProps) {
  const [yearMonth, setYearMonth] = useState(defaultNextMonth);
  const [paymentMethod, setPaymentMethod] = useState<string>('account');
  const [paymentDate, setPaymentDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const studentDiscount = truncateToThousands(monthlyTuition * (discountRate || 0) / 100);
  const finalAmount = Math.max(0, monthlyTuition - studentDiscount);

  useEffect(() => {
    if (!open) return;
    setYearMonth(defaultNextMonth());
    setPaymentMethod('account');
    setPaymentDate(new Date().toISOString().split('T')[0]);
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
            <Banknote className="h-5 w-5 text-emerald-600" />
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
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
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

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">기본 학원비</span>
              <span>{monthlyTuition.toLocaleString()}원</span>
            </div>
            {studentDiscount > 0 && (
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">학생 할인</span>
                <span className="text-rose-600">-{studentDiscount.toLocaleString()}원</span>
              </div>
            )}
            <div className="mt-1 flex justify-between font-semibold">
              <span>납부 금액</span>
              <span className="text-emerald-700">{finalAmount.toLocaleString()}원</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="early-pay-method">납부 방법</Label>
            <select
              id="early-pay-method"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
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
            <p className="text-sm text-rose-600" role="alert">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
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
