'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canView } from '@/lib/utils/permissions';
import { paymentsAPI } from '@/lib/api/payments';
import { ArrowLeft, Phone, AlertCircle, CreditCard, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import type { UnpaidPayment } from '@/lib/types/payment';

export default function MobileUnpaidPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<UnpaidPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!canView('payments')) {
      router.push('/m');
      return;
    }
    setHasPermission(true);
  }, [router]);

  useEffect(() => {
    if (hasPermission) {
      loadUnpaidPayments();
    }
  }, [hasPermission]);

  const loadUnpaidPayments = async () => {
    setLoading(true);
    try {
      const response = await paymentsAPI.getUnpaidPayments();
      setPayments(response.payments || []);
    } catch (err) {
      console.error('Failed to load unpaid payments:', err);
      toast.error('미납 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 전화걸기
  const handleCall = (phone?: string, parentPhone?: string) => {
    const numberToCall = phone || parentPhone;
    if (!numberToCall) {
      toast.error('등록된 전화번호가 없습니다.');
      return;
    }
    window.location.href = `tel:${numberToCall}`;
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  // 연체일수에 따른 색상
  const getOverdueColor = (days: number) => {
    if (days >= 30) return 'text-red-600 bg-red-50';
    if (days >= 14) return 'text-orange-600 bg-orange-50';
    if (days >= 7) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (hasPermission === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  // 총 미납액 계산
  const totalUnpaid = payments.reduce((sum, p) => sum + (p.final_amount - p.paid_amount), 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-red-500 text-white p-4 sticky top-0 z-10 safe-area-inset">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/m')} className="p-2 -ml-2">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">미납자 확인</h1>
        </div>
      </header>

      {/* 미납 목록 */}
      <main className="p-4 pb-8">
        {payments.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">미납자가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 요약 정보 */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">총 미납</p>
                  <p className="font-bold text-2xl text-red-600">{formatAmount(totalUnpaid)}원</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">미납 학생</p>
                  <p className="font-semibold text-lg">{payments.length}명</p>
                </div>
              </div>
            </div>

            {/* 미납자 카드 목록 */}
            <div className="space-y-3">
              {payments.map((payment) => {
                const unpaidAmount = payment.final_amount - payment.paid_amount;
                const hasPhone = payment.phone || payment.parent_phone;

                return (
                  <div
                    key={payment.id}
                    className="bg-white rounded-xl p-4 shadow-sm"
                  >
                    {/* 학생 정보 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full">
                          <User className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{payment.student_name}</p>
                          {payment.student_number && (
                            <p className="text-sm text-gray-500">{payment.student_number}</p>
                          )}
                        </div>
                      </div>

                      {/* 전화걸기 버튼 */}
                      <button
                        onClick={() => handleCall(payment.phone, payment.parent_phone)}
                        disabled={!hasPhone}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition active:scale-95 ${
                          hasPhone
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Phone className="h-5 w-5" />
                        전화
                      </button>
                    </div>

                    {/* 미납 정보 */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {payment.year_month}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOverdueColor(payment.days_overdue)}`}>
                          {payment.days_overdue > 0 ? `${payment.days_overdue}일 연체` : '미납'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">청구금액</span>
                        <span className="font-medium">{formatAmount(payment.final_amount)}원</span>
                      </div>

                      {payment.paid_amount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">납부금액</span>
                          <span className="text-green-600">-{formatAmount(payment.paid_amount)}원</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="font-semibold text-red-600">미납금액</span>
                        <span className="font-bold text-lg text-red-600">{formatAmount(unpaidAmount)}원</span>
                      </div>
                    </div>

                    {/* 전화번호 정보 */}
                    <div className="mt-3 text-sm text-gray-500">
                      {payment.phone && (
                        <p>학생: {payment.phone}</p>
                      )}
                      {payment.parent_phone && (
                        <p>학부모: {payment.parent_phone}</p>
                      )}
                      {!payment.phone && !payment.parent_phone && (
                        <p className="text-red-400">전화번호 미등록</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
