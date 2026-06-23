/**
 * Payment Amount Edit Modal
 * 학원비 금액(기본액/할인) 수동 수정 모달 — 일할 첫 달 학원비 등 개인 조정용
 */

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';

interface PaymentAmountEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { base_amount: number; discount_amount: number }) => Promise<void>;
  yearMonth: string;
  baseAmount: number;
  discountAmount: number;
}

export function PaymentAmountEditModal({
  isOpen,
  onClose,
  onSubmit,
  yearMonth,
  baseAmount,
  discountAmount,
}: PaymentAmountEditModalProps) {
  const [base, setBase] = useState(Math.floor(baseAmount));
  const [discount, setDiscount] = useState(Math.floor(discountAmount));
  const [submitting, setSubmitting] = useState(false);

  // 모달이 열릴 때마다 현재 값으로 리셋
  useEffect(() => {
    if (isOpen) {
      setBase(Math.floor(baseAmount));
      setDiscount(Math.floor(discountAmount));
    }
  }, [isOpen, baseAmount, discountAmount]);

  if (!isOpen) return null;

  const finalAmount = Math.max(0, base - discount);

  const handleSubmit = async () => {
    if (base < 0 || discount < 0) {
      toast.error('금액은 0원 이상이어야 합니다.');
      return;
    }
    if (discount > base) {
      toast.error('할인 금액이 기본 금액보다 클 수 없습니다.');
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit({ base_amount: base, discount_amount: discount });
      onClose();
    } catch {
      // onSubmit 내부에서 에러 toast 처리
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">학원비 금액 수정</CardTitle>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-5">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{yearMonth} 학원비</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">기본 금액 (원)</label>
              <MoneyInput value={base} onChange={setBase} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">할인 금액 (원)</label>
              <MoneyInput value={discount} onChange={setDiscount} />
            </div>

            <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">최종 청구 금액</span>
              <span className="text-lg font-bold text-foreground">{finalAmount.toLocaleString()}원</span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="button" className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
