'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canView, canEdit, isOwner } from '@/lib/utils/permissions';
import { paymentsAPI } from '@/lib/api/payments';
import { ArrowLeft, CreditCard, Calendar, User, Check, X, Loader2, Banknote, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Payment } from '@/lib/types/payment';

export default function MobileUnpaidPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [canViewAmount, setCanViewAmount] = useState(false);
  const [canMarkPaid, setCanMarkPaid] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'cash' | 'account'>('card');
  const [processing, setProcessing] = useState(false);
  const [dayName, setDayName] = useState<string>('');

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
    // 금액은 원장만 볼 수 있음
    setCanViewAmount(isOwner());
    // 납부 처리는 payments.edit 권한 있으면 가능
    setCanMarkPaid(canEdit('payments'));
  }, [router]);

  useEffect(() => {
    if (hasPermission) {
      loadUnpaidPayments();
    }
  }, [hasPermission]);

  const loadUnpaidPayments = async () => {
    setLoading(true);
    try {
      const data = await paymentsAPI.getUnpaidTodayPayments();
      setPayments(data);
      // day_name is computed locally
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      setDayName(days[new Date().getDay()]);
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
    if (days >= 30) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30';
    if (days >= 14) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30';
    if (days >= 7) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30';
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900';
  };

  // 완납 처리
  const handleMarkPaid = async () => {
    if (!selectedPayment) return;

    setProcessing(true);
    try {
      const unpaidAmount = (selectedPayment.final_amount || 0) - (selectedPayment.paid_amount || 0);
      await paymentsAPI.recordPayment(selectedPayment.id, {
        paid_amount: unpaidAmount,
        payment_method: selectedPaymentMethod,
        paid_date: new Date().toISOString().split('T')[0],
      });
      toast.success(`${selectedPayment.student_name} 완납 처리되었습니다.`);
      setSelectedPayment(null);
      setSelectedPaymentMethod('card');  // 초기화
      loadUnpaidPayments();  // 목록 새로고침
    } catch (err) {
      console.error('Failed to mark as paid:', err);
      toast.error('납부 처리에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  if (hasPermission === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  // 총 미납액 계산
  const totalUnpaid = payments.reduce((sum, p) => {
    const unpaid = (p.final_amount || 0) - (p.paid_amount || 0);
    return sum + (isNaN(unpaid) ? 0 : unpaid);
  }, 0);

  return (
    <div className="min-h-screen bg-muted">
      {/* 헤더 */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10 safe-area-inset">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/m')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">오늘 출석 미납자</h1>
            {dayName && (
              <p className="text-sm text-muted-foreground">{dayName}요일 수업 학생 중</p>
            )}
          </div>
        </div>
      </header>

      {/* 미납 목록 */}
      <main className="p-4 pb-8">
        {payments.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {dayName ? `오늘(${dayName}요일) 수업 학생 중 미납자가 없습니다.` : '미납자가 없습니다.'}
            </p>
          </div>
        ) : (
          <>
            {/* 요약 정보 */}
            <div className="bg-card rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex justify-between items-center">
                {canViewAmount ? (
                  <div>
                    <p className="text-sm text-muted-foreground">오늘 수업 미납</p>
                    <p className="font-bold text-2xl text-red-600 dark:text-red-400">{formatAmount(totalUnpaid)}원</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">오늘 수업 미납</p>
                    <p className="font-semibold text-lg text-foreground">확인 필요</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">미납 학생</p>
                  <p className="font-semibold text-lg text-foreground">{payments.length}명</p>
                </div>
              </div>
            </div>

            {/* 미납자 카드 목록 */}
            <div className="space-y-3">
              {payments.map((payment) => {
                const unpaidAmount = (payment.final_amount || 0) - (payment.paid_amount || 0);

                return (
                  <button
                    key={payment.id}
                    onClick={() => canMarkPaid && setSelectedPayment(payment)}
                    className={`w-full bg-card rounded-xl p-4 shadow-sm text-left transition-all ${
                      canMarkPaid ? 'active:scale-[0.98] hover:bg-muted dark:hover:bg-secondary/50' : ''
                    }`}
                  >
                    {/* 학생 정보 */}
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-50 dark:bg-amber-950/50 p-2 rounded-full">
                        <User className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg text-foreground">{payment.student_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{payment.year_month}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOverdueColor(payment.payment_status === 'overdue' ? 30 : 0)}`}>
                            {payment.payment_status === 'overdue' ? '연체' : '미납'}
                          </span>
                        </div>
                      </div>
                      {/* 금액 표시 (원장만) */}
                      {canViewAmount && (
                        <div className="text-right">
                          <p className="font-bold text-red-600 dark:text-red-400">{formatAmount(unpaidAmount)}원</p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* 완납 확인 모달 */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground">완납 처리</h3>
              <p className="text-muted-foreground mt-2">
                <span className="font-semibold text-foreground">{selectedPayment.student_name}</span>님의<br />
                {selectedPayment.year_month} 학원비
              </p>
              {/* 납부 금액 표시 */}
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-3">
                {formatAmount((selectedPayment.final_amount || 0) - (selectedPayment.paid_amount || 0))}원
              </p>
            </div>

            {/* 결제방법 선택 */}
            <div>
              <p className="text-sm text-muted-foreground mb-2 text-center">결제 방법</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('card')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    selectedPaymentMethod === 'card'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-sm font-medium">카드</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('account')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    selectedPaymentMethod === 'account'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Building2 className="h-5 w-5" />
                  <span className="text-sm font-medium">계좌</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('cash')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    selectedPaymentMethod === 'cash'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Banknote className="h-5 w-5" />
                  <span className="text-sm font-medium">현금</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 py-6"
                onClick={() => {
                  setSelectedPayment(null);
                  setSelectedPaymentMethod('card');
                }}
                disabled={processing}
              >
                <X className="h-5 w-5 mr-2" />
                취소
              </Button>
              <Button
                className="flex-1 py-6"
                onClick={handleMarkPaid}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    완납
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
