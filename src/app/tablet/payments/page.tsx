'use client';

/**
 * 태블릿 학원비 관리 페이지
 * - PC 컴포넌트 재사용
 * - 태블릿에 최적화된 레이아웃
 */

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Banknote, Search, ChevronLeft, ChevronRight, X, RefreshCw } from 'lucide-react';
import { PaymentList } from '@/components/payments/payment-list';
import { usePayments } from '@/hooks/use-payments';
import { paymentsAPI } from '@/lib/api/payments';
import {
  PAYMENT_STATUS_OPTIONS,
  type Payment,
} from '@/lib/types/payment';

function TabletPaymentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);

  // 년/월 상태
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const { payments, loading, error, filters, updateFilters, reload } = usePayments({
    year: yearMonth.year,
    month: yearMonth.month,
    include_previous_unpaid: true
  });

  // 납부 처리 상태
  const [markingPaymentId, setMarkingPaymentId] = useState<number | null>(null);

  // 납부 처리 핸들러
  const handlePaymentMark = useCallback(async (payment: Payment, method: 'account' | 'card' | 'cash') => {
    try {
      setMarkingPaymentId(payment.id);
      await paymentsAPI.recordPayment(payment.id, {
        paid_amount: payment.final_amount,
        payment_method: method,
        payment_date: new Date().toISOString().split('T')[0],
      });
      toast.success(`${payment.student_name}님 학원비 납부 완료`);
      reload();
    } catch (err) {
      console.error('Payment mark error:', err);
      toast.error('납부 처리 실패');
    } finally {
      setMarkingPaymentId(null);
    }
  }, [reload]);

  // URL에서 status 파라미터 읽기
  useEffect(() => {
    if (!initialFiltersApplied) {
      const statusFromUrl = searchParams.get('status');
      if (statusFromUrl === 'unpaid') {
        updateFilters({ payment_status: 'pending' as const });
      }
      setInitialFiltersApplied(true);
    }
  }, [searchParams, initialFiltersApplied, updateFilters]);

  // 년/월 변경 시 필터 업데이트
  useEffect(() => {
    updateFilters({ year: yearMonth.year, month: yearMonth.month });
  }, [yearMonth]);

  // 필터링
  const filteredPayments = payments.filter(p => {
    if (filters.search && !p.student_name?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const handlePaymentClick = (id: number) => {
    router.push(`/payments/${id}`);
  };

  const handleMonthChange = (delta: number) => {
    setYearMonth(prev => {
      const date = new Date(prev.year, prev.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  };

  const formatMonth = (year: number, month: number) => {
    return `${year}년 ${month}월`;
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return yearMonth.year === now.getFullYear() && yearMonth.month === now.getMonth() + 1;
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">학원비 관리</h1>
          <p className="text-muted-foreground">학원비 조회</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={reload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 현재 월과 전달 미납 분리
  const selectedYearMonth = `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}`;
  const currentMonthPayments = filteredPayments.filter((p) => p.year_month === selectedYearMonth);
  const previousUnpaidPayments = filteredPayments.filter((p) => p.year_month !== selectedYearMonth && p.payment_status !== 'paid');

  // 통계 계산 (현재 월 기준)
  const paidCount = currentMonthPayments.filter((p) => p.payment_status === 'paid').length;
  const unpaidCount = currentMonthPayments.filter((p) => p.payment_status === 'pending').length;
  const partialCount = currentMonthPayments.filter((p) => p.payment_status === 'partial').length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">학원비 관리</h1>
          <p className="text-muted-foreground">학원비 조회</p>
        </div>
        <Button variant="outline" onClick={reload}>
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 월 선택 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleMonthChange(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <p className="text-lg font-bold text-foreground">
                {formatMonth(yearMonth.year, yearMonth.month)}
              </p>
              {isCurrentMonth() && (
                <Badge variant="secondary" className="mt-1">이번달</Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleMonthChange(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 - 납부율 제거 (강사도 볼 수 있어서 매출 비공개) */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 청구</p>
                <p className="text-xl font-bold text-foreground">{currentMonthPayments.length}건</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <Banknote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">완납</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{paidCount}건</p>
              </div>
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Banknote className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">미납</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{unpaidCount}건</p>
                {previousUnpaidPayments.length > 0 && (
                  <p className="text-xs text-orange-500 mt-1">+ 전달 미납 {previousUnpaidPayments.length}건</p>
                )}
              </div>
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="학생 이름 검색..."
                value={filters.search || ''}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="w-full pl-10 pr-10 py-2 border border-border rounded-lg text-sm bg-card text-foreground"
              />
              {filters.search && (
                <button
                  onClick={() => updateFilters({ search: '' })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">납부 상태</label>
              <select
                value={filters.payment_status || ''}
                onChange={(e) => updateFilters({ payment_status: e.target.value as any })}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground"
              >
                <option value="">전체</option>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 결제 목록 */}
      <PaymentList
        payments={filteredPayments}
        loading={loading}
        onPaymentClick={handlePaymentClick}
        showPaymentMarkButton={true}
        onPaymentMark={handlePaymentMark}
        markingPaymentId={markingPaymentId}
      />
    </div>
  );
}

// 로딩 폴백
function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">학원비 관리</h1>
        <p className="text-muted-foreground">학원비 조회</p>
      </div>
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">학원비 정보를 불러오는 중...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TabletPaymentsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TabletPaymentsPageContent />
    </Suspense>
  );
}
