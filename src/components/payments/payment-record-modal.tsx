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
  onSubmit: (data: { paid_amount: number; payment_method: string; payment_date: string }) => Promise<void>;
  studentName: string;
  finalAmount: number;
  paidAmount?: number;
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
}: PaymentRecordModalProps) {
  // 소수점 제거하고 정수로 처리
  const finalAmountInt = Math.floor(finalAmount);
  const paidAmountInt = Math.floor(paidAmount);
  const remainingAmount = finalAmountInt - paidAmountInt;
  const [formData, setFormData] = useState({
    paid_amount: remainingAmount,
    payment_method: 'account',
    payment_date: new Date().toISOString().split('T')[0],
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.paid_amount <= 0) {
      toast.error('납부 금액을 입력해주세요.');
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit(formData);
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
      <Card className="w-full max-w-md bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">납부 기록</CardTitle>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 학생 정보 */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">학생</p>
              <p className="text-lg font-semibold text-gray-900">{studentName}</p>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-500">청구 금액</span>
                <span className="font-medium">{finalAmountInt.toLocaleString()}원</span>
              </div>
              {paidAmountInt > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">기납부 금액</span>
                  <span className="font-medium text-green-600">{paidAmountInt.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between text-sm mt-1 pt-1 border-t">
                <span className="text-gray-700 font-medium">미납 금액</span>
                <span className="font-bold text-primary-600">{remainingAmount.toLocaleString()}원</span>
              </div>
            </div>

            {/* 납부 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                납부 금액 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.paid_amount || ''}
                onChange={(e) => setFormData({ ...formData, paid_amount: Math.floor(Number(e.target.value)) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="0"
                min="0"
                step="1000"
                required
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleQuickAmount(remainingAmount)}
                  className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 transition-colors"
                >
                  전액 ({remainingAmount.toLocaleString()}원)
                </button>
                {remainingAmount > 100000 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(100000)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    10만원
                  </button>
                )}
                {remainingAmount > 50000 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(50000)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    5만원
                  </button>
                )}
              </div>
            </div>

            {/* 납부 방법 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                납부일 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
