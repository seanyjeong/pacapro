'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canView, isOwner, isAdmin } from '@/lib/utils/permissions';
import { paymentsAPI } from '@/lib/api/payments';
import { ArrowLeft, CreditCard, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import type { UnpaidPayment } from '@/lib/types/payment';

export default function MobileUnpaidPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<UnpaidPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [canViewAmount, setCanViewAmount] = useState(false);

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
    // 금액은 owner/admin만 볼 수 있음
    setCanViewAmount(isOwner() || isAdmin());
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

  // 금액 포맷
  const formatAmount = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '0';
    }
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
  const totalUnpaid = payments.reduce((sum, p) => {
    const unpaid = (p.final_amount || 0) - (p.paid_amount || 0);
    return sum + (isNaN(unpaid) ? 0 : unpaid);
  }, 0);

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
                {canViewAmount ? (
                  <div>
                    <p className="text-sm text-gray-500">총 미납</p>
                    <p className="font-bold text-2xl text-red-600">{formatAmount(totalUnpaid)}원</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">미납 현황</p>
                    <p className="font-semibold text-lg text-gray-700">확인 필요</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm text-gray-500">미납 학생</p>
                  <p className="font-semibold text-lg">{payments.length}명</p>
                </div>
              </div>
            </div>

            {/* 미납자 카드 목록 - 간소화 */}
            <div className="space-y-3">
              {payments.map((payment) => {
                const unpaidAmount = (payment.final_amount || 0) - (payment.paid_amount || 0);

                return (
                  <div
                    key={payment.id}
                    className="bg-white rounded-xl p-4 shadow-sm"
                  >
                    {/* 학생 정보 */}
                    <div className="flex items-center gap-3">
                      <div className="bg-red-100 p-2 rounded-full">
                        <User className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{payment.student_name}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{payment.year_month}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOverdueColor(payment.days_overdue || 0)}`}>
                            {(payment.days_overdue || 0) > 0 ? `${payment.days_overdue}일 연체` : '미납'}
                          </span>
                        </div>
                      </div>
                      {/* 금액 표시 (권한 있는 경우만) */}
                      {canViewAmount && (
                        <div className="text-right">
                          <p className="font-bold text-red-600">{formatAmount(unpaidAmount)}원</p>
                        </div>
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
