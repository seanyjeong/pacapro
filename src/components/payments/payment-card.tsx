/**
 * Payment Card Component
 * 학원비 상세 정보 카드
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Payment } from '@/lib/types/payment';
import {
  formatPaymentAmount,
  formatYearMonth,
  formatDate,
  getPaymentStatusColor,
  getPaymentTypeColor,
  isOverdue,
  calculateOverdueDays,
} from '@/lib/utils/payment-helpers';
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/types/payment';

interface PaymentCardProps {
  payment: Payment;
  onRecordPayment?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PaymentCard({ payment, onRecordPayment, onEdit, onDelete }: PaymentCardProps) {
  const overdue = isOverdue(payment);
  const daysOverdue = overdue ? calculateOverdueDays(payment.due_date) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">{payment.student_name}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">{payment.student_number}</p>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">청구 유형</p>
            <span
              className={`px-2 py-1 text-sm font-medium rounded ${getPaymentTypeColor(
                payment.payment_type
              )}`}
            >
              {PAYMENT_TYPE_LABELS[payment.payment_type]}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">청구 월</p>
            <p className="font-medium">{formatYearMonth(payment.year_month)}</p>
          </div>
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
            {payment.additional_amount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>{payment.notes?.includes('비시즌 종강 일할') ? '비시즌 종강 일할' : '추가 금액'}</span>
                <span className="font-medium">+{formatPaymentAmount(payment.additional_amount)}</span>
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
              {formatDate(payment.due_date)}
            </p>
          </div>
          {payment.paid_date && (
            <div>
              <p className="text-sm text-gray-500 mb-1">납부일</p>
              <p className="font-medium text-green-600">{formatDate(payment.paid_date)}</p>
            </div>
          )}
        </div>

        {payment.payment_method && (
          <div>
            <p className="text-sm text-gray-500 mb-1">납부 방법</p>
            <p className="font-medium">{PAYMENT_METHOD_LABELS[payment.payment_method]}</p>
          </div>
        )}

        {payment.description && (
          <div>
            <p className="text-sm text-gray-500 mb-1">설명</p>
            <p>{payment.description}</p>
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
