/**
 * Student Payments Component
 * 학생 납부 내역 컴포넌트 - DB 스키마와 일치
 */

import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import type { StudentPayment } from '@/lib/types/student';
import { formatDate, formatCurrency, getPaymentStatusColor } from '@/lib/utils/student-helpers';
import { PAYMENT_STATUS_LABELS } from '@/lib/types/student';

interface StudentPaymentsProps {
  payments: StudentPayment[];
  loading?: boolean;
}

export function StudentPaymentsComponent({ payments, loading }: StudentPaymentsProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">납부 내역을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">납부 내역이 없습니다</h3>
          <p className="text-gray-600">아직 등록된 납부 내역이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  납부 기간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  납부 금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  납부 방법
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  납부일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => {
                const finalAmount = parseFloat(payment.final_amount) || 0;
                const paidAmount = parseFloat(payment.paid_amount) || 0;
                const remaining = finalAmount - paidAmount;

                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    {/* 납부 기간 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.year_month}</div>
                      <div className="text-xs text-gray-500">납부기한: {formatDate(payment.due_date)}</div>
                    </td>

                    {/* 금액 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{formatCurrency(payment.final_amount)}</div>
                      {parseFloat(payment.discount_amount) > 0 && (
                        <div className="text-xs text-gray-500">할인: {formatCurrency(payment.discount_amount)}</div>
                      )}
                    </td>

                    {/* 납부 금액 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(payment.paid_amount)}</div>
                      {remaining > 0 && (
                        <div className="text-xs text-red-500">
                          미납: {formatCurrency(remaining)}
                        </div>
                      )}
                    </td>

                    {/* 납부 방법 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.payment_method || '-'}</div>
                    </td>

                    {/* 납부일 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment.paid_date ? formatDate(payment.paid_date) : '-'}
                      </div>
                    </td>

                    {/* 상태 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPaymentStatusColor(
                          payment.payment_status
                        )}`}
                      >
                        {PAYMENT_STATUS_LABELS[payment.payment_status] || payment.payment_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
