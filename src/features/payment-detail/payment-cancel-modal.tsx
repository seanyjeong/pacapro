'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Calendar, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { Textarea } from '@/components/ui/textarea';
import type { PaymentCancelData } from '@/lib/types/payment';

interface PaymentCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentCancelData) => Promise<void>;
  studentName: string;
  paidAmount: number;
  canceling: boolean;
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function PaymentCancelModal({
  isOpen,
  onClose,
  onSubmit,
  studentName,
  paidAmount,
  canceling,
}: PaymentCancelModalProps) {
  const paidAmountInt = Math.floor(paidAmount);
  const [cancelAmount, setCancelAmount] = useState(paidAmountInt);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDate, setCancelDate] = useState(getTodayString());

  useEffect(() => {
    if (!isOpen) return;
    setCancelAmount(paidAmountInt);
    setCancelReason('');
    setCancelDate(getTodayString());
  }, [isOpen, paidAmountInt]);

  if (!isOpen) return null;

  const afterCancelPaidAmount = Math.max(paidAmountInt - cancelAmount, 0);

  const handleClose = () => {
    if (!canceling) onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const reason = cancelReason.trim();
    if (cancelAmount <= 0) {
      toast.error('취소 금액을 입력해주세요.');
      return;
    }
    if (cancelAmount > paidAmountInt) {
      toast.error('현재 납부액보다 큰 금액은 취소할 수 없습니다.');
      return;
    }
    if (!reason) {
      toast.error('결제 취소 사유를 입력해주세요.');
      return;
    }
    if (reason.length > 500) {
      toast.error('취소 사유는 500자 이내로 입력해주세요.');
      return;
    }

    try {
      await onSubmit({
        cancel_amount: cancelAmount,
        cancel_reason: reason,
        cancel_date: cancelDate,
      });
      onClose();
    } catch {
      // Parent hook shows the Korean error toast.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-cancel-title"
      onClick={handleClose}
    >
      <Card className="w-full max-w-md shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle id="payment-cancel-title" className="flex items-center gap-2 text-xl">
              <RotateCcw className="h-5 w-5 text-rose-600" />
              결제 취소
            </CardTitle>
            <button
              type="button"
              onClick={handleClose}
              aria-label="결제 취소 닫기"
              className="rounded-full p-1 transition-colors hover:bg-muted"
              disabled={canceling}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">학생</p>
              <p className="text-lg font-semibold text-foreground">{studentName}</p>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">현재 납부액</span>
                <span className="font-medium">{paidAmountInt.toLocaleString()}원</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm">
                <span className="font-medium text-foreground">취소 후 납부액</span>
                <span className="font-bold text-rose-600">{afterCancelPaidAmount.toLocaleString()}원</span>
              </div>
            </div>

            <div>
              <label htmlFor="payment-cancel-amount" className="mb-2 block text-sm font-medium text-foreground">
                취소 금액 <span className="text-rose-500">*</span>
              </label>
              <MoneyInput
                id="payment-cancel-amount"
                value={cancelAmount}
                onChange={setCancelAmount}
                disabled={canceling}
                className="rounded-lg py-3 text-lg font-semibold focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="payment-cancel-date" className="mb-2 block text-sm font-medium text-foreground">
                취소일 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="payment-cancel-date"
                  type="date"
                  value={cancelDate}
                  onChange={(event) => setCancelDate(event.target.value)}
                  disabled={canceling}
                  className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 focus:border-rose-500 focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="payment-cancel-reason" className="mb-2 block text-sm font-medium text-foreground">
                취소 사유 <span className="text-rose-500">*</span>
              </label>
              <Textarea
                id="payment-cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="예: 카드 승인 취소, 중복 입금, 환불 처리"
                disabled={canceling}
                maxLength={500}
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={canceling} className="flex-1">
                닫기
              </Button>
              <Button type="submit" disabled={canceling} className="flex-1 bg-rose-600 text-white hover:bg-rose-700">
                {canceling ? '취소 처리 중' : '결제 취소하기'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
