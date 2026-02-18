'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Download, AlertCircle, Bell, Search, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentList } from '@/components/payments/payment-list';
import { ManualCreditModal } from '@/components/students/manual-credit-modal';
import { usePayments } from '@/hooks/use-payments';
import { paymentsAPI } from '@/lib/api/payments';
import { studentsAPI } from '@/lib/api/students';
import { notificationsAPI } from '@/lib/api/notifications';
import { usePermissions } from '@/lib/utils/permissions';
import {
  PAYMENT_STATUS_OPTIONS,
} from '@/lib/types/payment';
import type { Payment } from '@/lib/types/payment';
import { parseClassDays } from '@/lib/types/student';

function PaymentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);

  // 현재 월 기본값
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const { payments, loading, error, filters, updateFilters, resetFilters, reload } = usePayments({
    year: currentYear,
    month: currentMonth,
    include_previous_unpaid: true, // 이전 달 미납자 포함
  });

  // URL에서 status 파라미터 읽기 (대시보드에서 미납 확인하기 클릭 시) - 클라이언트 사이드에서만
  useEffect(() => {
    if (!initialFiltersApplied) {
      const statusFromUrl = searchParams.get('status');
      if (statusFromUrl === 'unpaid') {
        updateFilters({ payment_status: 'unpaid' });
      }
      setInitialFiltersApplied(true);
    }
  }, [searchParams, initialFiltersApplied, updateFilters]);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [markingPaymentId, setMarkingPaymentId] = useState<number | null>(null);

  // 크레딧 모달 상태
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditStudentInfo, setCreditStudentInfo] = useState<{
    studentId: number;
    studentName: string;
    monthlyTuition: number;
    weeklyCount: number;
    classDays: number[];
  } | null>(null);

  const { canEdit, canView, isOwner } = usePermissions();
  const canEditPayments = canEdit('payments');
  const canViewPayments = canView('payments');
  const viewOnly = canViewPayments && !canEditPayments; // view만 있고 edit 없는 경우

  // view 권한만 있으면 미납 내역만 표시 + 검색어 필터링
  const filteredPayments = payments.filter(p => {
    // view 권한만 있으면 미납만
    if (viewOnly && p.payment_status === 'paid') return false;
    // 검색어 필터
    if (filters.search && !p.student_name?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const handlePaymentClick = (id: number) => {
    router.push(`/payments/${id}`);
  };

  const handleAddPayment = () => {
    router.push('/payments/new');
  };

  const handleSendUnpaidNotification = async () => {
    const unpaidList = filteredPayments.filter(p => p.payment_status !== 'paid');
    if (unpaidList.length === 0) {
      toast.error('미납자가 없습니다.');
      return;
    }

    if (!confirm(`미납자 ${unpaidList.length}명에게 알림톡을 발송하시겠습니까?`)) return;

    try {
      setSendingNotification(true);
      const today = new Date();
      const [yearStr, monthStr] = (filters.year_month || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`).split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      const result = await notificationsAPI.sendUnpaid(year, month);
      toast.success(`알림 발송 완료: ${result.sent}명 성공, ${result.failed}명 실패`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '알림 발송에 실패했습니다.');
    } finally {
      setSendingNotification(false);
    }
  };

  // 크레딧 버튼 클릭 핸들러
  const handleCreditClick = async (payment: Payment) => {
    try {
      // 학생 정보 조회
      const result = await studentsAPI.getStudent(payment.student_id);
      const student = result.student;
      setCreditStudentInfo({
        studentId: student.id,
        studentName: student.name,
        monthlyTuition: parseFloat(student.monthly_tuition) || 0,
        weeklyCount: student.weekly_count || 2,
        classDays: parseClassDays(student.class_days || []),
      });
      setCreditModalOpen(true);
    } catch (err: any) {
      toast.error('학생 정보를 불러오는데 실패했습니다.');
      console.error('Failed to fetch student:', err);
    }
  };

  // 크레딧 생성 성공 핸들러
  const handleCreditSuccess = () => {
    reload();
  };

  // 빠른 납부 처리 핸들러
  const handleQuickPaymentMark = async (payment: Payment, method: 'account' | 'card' | 'cash' | 'other') => {
    try {
      setMarkingPaymentId(payment.id);
      
      await paymentsAPI.recordPayment(payment.id, {
        paid_amount: parseFloat(String(payment.final_amount)) - parseFloat(String(payment.paid_amount || 0)),
        payment_method: method,
        paid_date: new Date().toISOString().split('T')[0],
        notes: `빠른 납부 처리 (${method})`,
      });

      toast.success(`${payment.student_name}님의 학원비가 납부 처리되었습니다.`);
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '납부 처리에 실패했습니다.');
      console.error('Failed to mark payment:', err);
    } finally {
      setMarkingPaymentId(null);
    }
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">학원비 관리</h1>
          <p className="text-muted-foreground mt-1">학원비 청구 및 납부 관리</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={reload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 통계는 선택된 월 기준 (이전 달 미납자는 제외)
  const selectedYearMonth = filters.year_month || `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const currentMonthPayments = filteredPayments.filter((p) => p.year_month === selectedYearMonth);
  const previousUnpaidPayments = filteredPayments.filter((p) => p.year_month !== selectedYearMonth);

  const paidCount = currentMonthPayments.filter((p) => p.payment_status === 'paid').length;
  const unpaidCount = currentMonthPayments.filter((p) => p.payment_status === 'unpaid' || p.payment_status === 'overdue').length;
  const partialCount = currentMonthPayments.filter((p) => p.payment_status === 'partial').length;
  const totalAmount = Math.floor(currentMonthPayments.reduce((sum, p) => sum + parseFloat(String(p.final_amount)), 0));
  const paidAmount = Math.floor(currentMonthPayments
    .filter((p) => p.payment_status === 'paid')
    .reduce((sum, p) => sum + parseFloat(String(p.final_amount)), 0));
  const unpaidAmount = Math.floor(currentMonthPayments
    .filter((p) => p.payment_status !== 'paid')
    .reduce((sum, p) => sum + parseFloat(String(p.final_amount)) - parseFloat(String(p.paid_amount || 0)), 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {viewOnly ? '미납 학원비' : '학원비 관리'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewOnly ? '미납 학원비 현황 조회' : '학원비 청구 및 납부 관리'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={reload}>
            새로고침
          </Button>
          {canEditPayments && (
            <>
              <Button variant="outline" onClick={handleSendUnpaidNotification} disabled={sendingNotification || unpaidCount === 0}>
                <Bell className="w-4 h-4 mr-2" />
                {sendingNotification ? '발송 중...' : `미납 알림 (${unpaidCount}명)`}
              </Button>
              <Button onClick={handleAddPayment}>
                <Plus className="w-4 h-4 mr-2" />
                학원비 청구
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${viewOnly ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-4`}>
        {viewOnly ? (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">미납 건수</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{filteredPayments.length}건</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">미납 금액</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{unpaidAmount.toLocaleString()}원</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">총 청구</p>
                    <p className="text-2xl font-bold text-foreground">{filteredPayments.length}건</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">완납</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{paidCount}건</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">미납</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{unpaidCount}건</p>
                    {previousUnpaidPayments.length > 0 && (
                      <p className="text-xs text-orange-500 mt-1">+ 전달 미납 {previousUnpaidPayments.length}건</p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div>
                  <p className="text-sm text-muted-foreground">납부율</p>
                  <p className="text-2xl font-bold text-foreground">
                    {filteredPayments.length > 0 ? Math.round((paidCount / filteredPayments.length) * 100) : 0}%
                  </p>
                  {isOwner && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {paidAmount.toLocaleString()} / {totalAmount.toLocaleString()}원
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="학생 이름 검색..."
                value={filters.search || ''}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-9 pr-3 py-1.5 border border-border rounded-md text-sm w-48 bg-card text-foreground"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">납부 상태</label>
              <select
                value={filters.payment_status || ''}
                onChange={(e) => updateFilters({ payment_status: e.target.value as any })}
                className="ml-2 px-3 py-1 border border-border rounded-md text-sm bg-card text-foreground"
              >
                <option value="">전체</option>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">청구 월</label>
              <input
                type="month"
                value={filters.year_month || ''}
                onChange={(e) => {
                  updateFilters({ year_month: e.target.value });
                }}
                className="px-3 py-1 border border-border rounded-md text-sm bg-card text-foreground"
              />
            </div>

            <Button variant="outline" onClick={() => updateFilters({
              year_month: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
              payment_status: undefined,
              search: undefined,
            })} className="ml-auto">
              필터 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      <PaymentList
        payments={filteredPayments}
        loading={loading}
        onPaymentClick={handlePaymentClick}
        onCreditClick={canEditPayments ? handleCreditClick : undefined}
        showCreditButton={canEditPayments}
        onPaymentMark={canEditPayments ? handleQuickPaymentMark : undefined}
        showPaymentMarkButton={canEditPayments}
        markingPaymentId={markingPaymentId}
        confirmBeforePayment={true}
      />

      {/* 크레딧 모달 */}
      {creditStudentInfo && (
        <ManualCreditModal
          open={creditModalOpen}
          onClose={() => {
            setCreditModalOpen(false);
            setCreditStudentInfo(null);
          }}
          studentId={creditStudentInfo.studentId}
          studentName={creditStudentInfo.studentName}
          monthlyTuition={creditStudentInfo.monthlyTuition}
          weeklyCount={creditStudentInfo.weeklyCount}
          classDays={creditStudentInfo.classDays}
          onSuccess={handleCreditSuccess}
        />
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">학원비 관리</h1>
          <p className="text-muted-foreground mt-1">학원비 청구 및 납부 관리</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">학원비 정보를 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <PaymentsPageContent />
    </Suspense>
  );
}
