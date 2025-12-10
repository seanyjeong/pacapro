/**
 * Payment Record Modal
 * 납부 기록 모달 컴포넌트
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, CreditCard, Banknote, Building2, HelpCircle, Calendar } from 'lucide-react';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/types/payment';

interface PaymentRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { paid_amount: number; payment_method: string; payment_date: string; discount_amount?: number }) => Promise<void>;
  studentName: string;
  finalAmount: number;
  paidAmount?: number;
  baseAmount?: number; // 기본 청구 금액 (할인 전)
  existingDiscount?: number; // 기존 할인 금액
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  account: <Building2 className="w-5 h-5" />,
  card: <CreditCard className="w-5 h-5" />,
  cash: <Banknote className="w-5 h-5" />,
  other: <HelpCircle className="w-5 h-5" />,
};

export function PaymentRecordModal({
  isOpen,
  onClose,
  onSubmit,
  studentName,
  finalAmount,
  paidAmount = 0,
  baseAmount,
  existingDiscount = 0,
}: PaymentRecordModalProps) {
  // 소수점 제거하고 정수로 처리
  const finalAmountInt = Math.floor(finalAmount);
  const paidAmountInt = Math.floor(paidAmount);
  const baseAmountInt = baseAmount ? Math.floor(baseAmount) : finalAmountInt;
  const existingDiscountInt = Math.floor(existingDiscount);
  const remainingAmount = finalAmountInt - paidAmountInt;

  const [formData, setFormData] = useState({
    paid_amount: remainingAmount,
    payment_method: 'account',
    payment_date: new Date().toISOString().split('T')[0],
    discount_amount: 0, // 추가 할인
  });
  const [submitting, setSubmitting] = useState(false);

  // 추가 할인 적용 후 실제 납부해야 할 금액
  const actualRemainingAmount = Math.max(0, remainingAmount - formData.discount_amount);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 0원 청구 건은 0원 납부 허용 (100% 할인 등)
    if (formData.paid_amount < 0) {
      toast.error('납부 금액은 0원 이상이어야 합니다.');
      return;
    }
    // 미납금이 있는데 0원 납부하려는 경우만 차단 (할인 제외)
    if (formData.paid_amount === 0 && actualRemainingAmount > 0) {
      toast.error('납부 금액을 입력해주세요.');
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit({
        paid_amount: formData.paid_amount,
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        discount_amount: formData.discount_amount > 0 ? formData.discount_amount : undefined,
      });
      onClose();
    } catch (err) {
      // Error handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAmount = (amount: number) => {
    setFormData({ ...formData, paid_amount: amount });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">납부 기록</CardTitle>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 학생 정보 */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">학생</p>
              <p className="text-lg font-semibold text-foreground">{studentName}</p>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">청구 금액</span>
                <span className="font-medium">{finalAmountInt.toLocaleString()}원</span>
              </div>
              {paidAmountInt > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">기납부 금액</span>
                  <span className="font-medium text-green-600">{paidAmountInt.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between text-sm mt-1 pt-1 border-t border-border">
                <span className="text-foreground font-medium">미납 금액</span>
                <span className="font-bold text-primary-600">{remainingAmount.toLocaleString()}원</span>
              </div>
            </div>

            {/* 할인 금액 (선택) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                할인 금액 <span className="text-muted-foreground text-xs font-normal">(선택사항)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.discount_amount || ''}
                  onChange={(e) => {
                    const discount = Math.floor(Number(e.target.value)) || 0;
                    const newRemaining = Math.max(0, remainingAmount - discount);
                    setFormData({
                      ...formData,
                      discount_amount: discount,
                      paid_amount: newRemaining // 할인 적용 시 납부 금액 자동 조정
                    });
                  }}
                  className="w-full px-4 py-2 border border-border bg-background rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                  placeholder="0"
                  min="0"
                  max={remainingAmount}
                  step="10000"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">원</span>
              </div>
              {formData.discount_amount > 0 && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">미납금: </span>
                  <span className="line-through text-muted-foreground/70 mr-1">{remainingAmount.toLocaleString()}원</span>
                  <span className="text-red-500 mr-1">-{formData.discount_amount.toLocaleString()}원</span>
                  <span className="font-bold text-blue-600">→ {actualRemainingAmount.toLocaleString()}원</span>
                </p>
              )}
            </div>

            {/* 납부 금액 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                납부 금액 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.paid_amount}
                onChange={(e) => setFormData({ ...formData, paid_amount: Math.floor(Number(e.target.value)) })}
                className="w-full px-4 py-3 border border-border bg-background rounded-lg text-lg font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="0"
                min="0"
                step="1000"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleQuickAmount(actualRemainingAmount)}
                  className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 transition-colors"
                >
                  전액 ({actualRemainingAmount.toLocaleString()}원)
                </button>
                {actualRemainingAmount > 100000 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(100000)}
                    className="px-3 py-1 text-xs bg-muted text-foreground rounded-full hover:bg-muted/80 transition-colors"
                  >
                    10만원
                  </button>
                )}
                {actualRemainingAmount > 50000 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(50000)}
                    className="px-3 py-1 text-xs bg-muted text-foreground rounded-full hover:bg-muted/80 transition-colors"
                  >
                    5만원
                  </button>
                )}
              </div>
            </div>

            {/* 납부 방법 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                납부 방법 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_method: option.value })}
                    className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-all ${
                      formData.payment_method === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 ring-2 ring-primary-200 dark:ring-primary-800'
                        : 'border-border hover:border-border hover:bg-muted'
                    }`}
                  >
                    {PAYMENT_METHOD_ICONS[option.value]}
                    <span className="font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 납부일 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                납부일 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-border bg-background rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? '처리 중...' : '납부 기록'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
