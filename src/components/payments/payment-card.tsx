/**
 * Payment Card Component
 * 학원비 상세 정보 카드
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X } from 'lucide-react';
import type { Payment } from '@/lib/types/payment';
import {
  formatPaymentAmount,
  formatYearMonth,
  formatDate,
  getPaymentStatusColor,
  isOverdue,
  calculateOverdueDays,
} from '@/lib/utils/payment-helpers';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/types/payment';

interface PaymentCardProps {
  payment: Payment;
  onRecordPayment?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdatePaidDate?: (paidDate: string) => Promise<void>;
}

export function PaymentCard({ payment, onRecordPayment, onEdit, onDelete, onUpdatePaidDate }: PaymentCardProps) {
  const overdue = isOverdue(payment);
  const daysOverdue = overdue && payment.due_date ? calculateOverdueDays(payment.due_date) : 0;

  // 납부일 수정 상태
  const [isEditingPaidDate, setIsEditingPaidDate] = useState(false);
  const [editPaidDate, setEditPaidDate] = useState(payment.paid_date?.split('T')[0] || '');
  const [savingPaidDate, setSavingPaidDate] = useState(false);

  const handleSavePaidDate = async () => {
    if (!onUpdatePaidDate || !editPaidDate) return;
    try {
      setSavingPaidDate(true);
      await onUpdatePaidDate(editPaidDate);
      setIsEditingPaidDate(false);
    } catch (err) {
      // Error handled by parent
    } finally {
      setSavingPaidDate(false);
    }
  };

  const handleCancelEditPaidDate = () => {
    setEditPaidDate(payment.paid_date?.split('T')[0] || '');
    setIsEditingPaidDate(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">{payment.student_name}</CardTitle>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded ${getPaymentStatusColor(
              payment.payment_status
            )}`}
          >
            {PAYMENT_STATUS_LABELS[payment.payment_status]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdue && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800 font-semibold">
              {daysOverdue}일 연체 중입니다
            </p>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-500 mb-1">청구 월</p>
          <p className="font-medium">{formatYearMonth(payment.year_month)}</p>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">금액 정보</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">기본 금액</span>
              <span className="font-medium">{formatPaymentAmount(payment.base_amount)}</span>
            </div>
            {payment.discount_amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>할인 금액</span>
                <span className="font-medium">-{formatPaymentAmount(payment.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>최종 청구 금액</span>
              <span>{formatPaymentAmount(payment.final_amount)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">납부 기한</p>
            <p className={`font-medium ${overdue ? 'text-red-600' : ''}`}>
              {payment.due_date ? formatDate(payment.due_date) : '-'}
            </p>
          </div>
          {payment.paid_date && (
            <div>
              <p className="text-sm text-gray-500 mb-1">납부일</p>
              {isEditingPaidDate ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={editPaidDate}
                    onChange={(e) => setEditPaidDate(e.target.value)}
                    className="px-2 py-1 border border-border bg-background rounded text-sm"
                    disabled={savingPaidDate}
                  />
                  <button
                    onClick={handleSavePaidDate}
                    disabled={savingPaidDate}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="저장"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEditPaidDate}
                    disabled={savingPaidDate}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                    title="취소"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-medium text-green-600">{formatDate(payment.paid_date)}</p>
                  {onUpdatePaidDate && (
                    <button
                      onClick={() => setIsEditingPaidDate(true)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="납부일 수정"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {payment.payment_method && (
          <div>
            <p className="text-sm text-gray-500 mb-1">납부 방법</p>
            <p className="font-medium">{PAYMENT_METHOD_LABELS[payment.payment_method]}</p>
          </div>
        )}

        {payment.notes && (
          <div>
            <p className="text-sm text-gray-500 mb-1">메모</p>
            <p className="text-sm text-gray-700">{payment.notes}</p>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          {payment.payment_status !== 'paid' && onRecordPayment && (
            <Button onClick={onRecordPayment} className="flex-1">
              납부 기록
            </Button>
          )}
          {onEdit && (
            <Button variant="secondary" onClick={onEdit}>
              수정
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              삭제
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
