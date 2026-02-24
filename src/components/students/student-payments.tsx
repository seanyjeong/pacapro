/**
 * Student Payments Component
 * 학생 납부 내역 + 크레딧 관리 컴포넌트
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Plus, Coins, Banknote } from 'lucide-react';
import type { StudentPayment, RestCredit } from '@/lib/types/student';
import { formatDate, formatCurrency, getPaymentStatusColor } from '@/lib/utils/student-helpers';
import { PAYMENT_STATUS_LABELS, REST_CREDIT_TYPE_LABELS, REST_CREDIT_STATUS_LABELS, parseClassDays } from '@/lib/types/student';
import { PAYMENT_METHOD_LABELS } from '@/lib/types/payment';
import { studentsAPI } from '@/lib/api/students';
import { ManualCreditModal } from './manual-credit-modal';
import { PrepaidPaymentModal } from '@/components/payments/prepaid-payment-modal';

interface StudentPaymentsProps {
  payments: StudentPayment[];
  loading?: boolean;
  // 크레딧 기능용 추가 props
  studentId?: number;
  studentName?: string;
  monthlyTuition?: number;
  weeklyCount?: number;
  classDays?: number[] | string | import('@/lib/types/student').ClassDaySlot[];
}

// 크레딧 타입별 배지 색상
function getCreditTypeBadgeColor(type: string) {
  switch (type) {
    case 'carryover':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800';
    case 'excused':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800';
    case 'manual':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800';
    case 'refund':
      return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
  }
}

// 크레딧 상태별 배지 색상
function getCreditStatusBadgeColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800';
    case 'partial':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800';
    case 'applied':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800';
    case 'refunded':
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
  }
}

export function StudentPaymentsComponent({
  payments,
  loading,
  studentId,
  studentName,
  monthlyTuition,
  weeklyCount,
  classDays,
}: StudentPaymentsProps) {
  // 크레딧 상태
  const [credits, setCredits] = useState<RestCredit[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [prepaidModalOpen, setPrepaidModalOpen] = useState(false);

  // 크레딧 적용 모달 상태
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<RestCredit | null>(null);
  const [applyYearMonth, setApplyYearMonth] = useState('');
  const [applying, setApplying] = useState(false);

  // 크레딧 목록 조회
  const loadCredits = useCallback(async () => {
    if (!studentId) return;

    try {
      setCreditsLoading(true);
      const result = await studentsAPI.getRestCredits(studentId);
      setCredits(result.credits);
      setPendingTotal(result.pendingTotal);
    } catch (err) {
      console.error('Failed to load credits:', err);
    } finally {
      setCreditsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  // 크레딧 생성 성공 시
  const handleCreditSuccess = () => {
    loadCredits();
  };

  // 크레딧 적용 모달 열기
  const openApplyModal = (credit: RestCredit) => {
    setSelectedCredit(credit);
    // 현재 월을 기본값으로
    const now = new Date();
    setApplyYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setApplyModalOpen(true);
  };

  // 크레딧 적용 처리
  const handleApplyCredit = async () => {
    if (!studentId || !selectedCredit || !applyYearMonth) return;

    try {
      setApplying(true);
      const result = await studentsAPI.applyCredit(studentId, selectedCredit.id, applyYearMonth);
      alert(result.message);
      setApplyModalOpen(false);
      setSelectedCredit(null);
      loadCredits(); // 크레딧 목록 새로고침
      window.location.reload(); // 페이지 새로고침으로 학원비도 갱신
    } catch (err: any) {
      console.error('Failed to apply credit:', err);
      alert(err.response?.data?.message || '크레딧 적용에 실패했습니다.');
    } finally {
      setApplying(false);
    }
  };

  // 크레딧 기능 사용 가능 여부
  const canUseCredit = studentId && studentName && monthlyTuition && weeklyCount;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">납부 내역을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 크레딧 섹션 */}
      {canUseCredit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-600" />
                크레딧
                {pendingTotal > 0 && (
                  <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
                    (미사용: {pendingTotal.toLocaleString()}원)
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                미사용 크레딧은 다음 달 수강료 생성 시 자동 차감됩니다.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPrepaidModalOpen(true)}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                <Banknote className="w-4 h-4 mr-1" />
                선납 결제
              </Button>
              <Button
                size="sm"
                onClick={() => setCreditModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                크레딧 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {creditsLoading ? (
              <div className="text-center py-4 text-muted-foreground">로딩 중...</div>
            ) : credits.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                등록된 크레딧이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {credits.map((credit) => (
                  <div
                    key={credit.id}
                    className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg ${
                      credit.status === 'applied' ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getCreditTypeBadgeColor(credit.credit_type)}`}>
                        {REST_CREDIT_TYPE_LABELS[credit.credit_type] || credit.credit_type}
                      </span>
                      <div>
                        <div className={`text-sm font-medium ${credit.status === 'applied' ? 'line-through text-muted-foreground' : ''}`}>
                          {credit.credit_amount.toLocaleString()}원
                          {credit.remaining_amount !== credit.credit_amount && (
                            <span className="text-muted-foreground ml-1">
                              (잔액: {credit.remaining_amount.toLocaleString()}원)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {credit.rest_start_date === credit.rest_end_date
                            ? formatDate(credit.rest_start_date)
                            : `${formatDate(credit.rest_start_date)} ~ ${formatDate(credit.rest_end_date)}`}
                          {credit.rest_days > 0 && ` (${credit.rest_days}회)`}
                        </div>
                        {credit.notes && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                            {credit.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(credit.status === 'pending' || credit.status === 'partial') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => openApplyModal(credit)}
                        >
                          적용
                        </Button>
                      )}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getCreditStatusBadgeColor(credit.status)}`}>
                        {REST_CREDIT_STATUS_LABELS[credit.status] || credit.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 납부 내역 섹션 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            납부 내역
            {payments.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({payments.length}건)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">납부 내역이 없습니다</h3>
              <p className="text-muted-foreground">아직 등록된 납부 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      납부 기간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      금액
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      납부 금액
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      납부 방법
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      납부일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {payments.map((payment) => {
                    const finalAmount = parseFloat(payment.final_amount) || 0;
                    const paidAmount = parseFloat(payment.paid_amount) || 0;
                    const remaining = finalAmount - paidAmount;

                    return (
                      <tr key={payment.id} className="hover:bg-muted/50">
                        {/* 납부 기간 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{payment.year_month}</div>
                          <div className="text-xs text-muted-foreground">납부기한: {formatDate(payment.due_date)}</div>
                        </td>

                        {/* 금액 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-foreground">{formatCurrency(payment.final_amount)}</div>
                          {parseFloat(payment.discount_amount) > 0 && (
                            <div className="text-xs text-muted-foreground">할인: {formatCurrency(payment.discount_amount)}</div>
                          )}
                        </td>

                        {/* 납부 금액 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{formatCurrency(payment.paid_amount)}</div>
                          {remaining > 0 && (
                            <div className="text-xs text-red-500 dark:text-red-400">
                              미납: {formatCurrency(remaining)}
                            </div>
                          )}
                        </td>

                        {/* 납부 방법 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method : '-'}</div>
                        </td>

                        {/* 납부일 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">
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
          )}
        </CardContent>
      </Card>

      {/* 수동 크레딧 모달 */}
      {canUseCredit && (
        <ManualCreditModal
          open={creditModalOpen}
          onClose={() => setCreditModalOpen(false)}
          studentId={studentId}
          studentName={studentName}
          monthlyTuition={monthlyTuition}
          weeklyCount={weeklyCount}
          classDays={parseClassDays(classDays || [])}
          onSuccess={handleCreditSuccess}
        />
      )}

      {/* 선납 결제 모달 */}
      {canUseCredit && (
        <PrepaidPaymentModal
          open={prepaidModalOpen}
          onClose={() => setPrepaidModalOpen(false)}
          studentId={studentId}
          studentName={studentName}
          monthlyTuition={monthlyTuition}
          onSuccess={() => {
            loadCredits();
            window.location.reload();
          }}
        />
      )}

      {/* 크레딧 적용 모달 */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>크레딧 적용</DialogTitle>
          </DialogHeader>
          <div className="py-6 px-6 space-y-4">
            {selectedCredit && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getCreditTypeBadgeColor(selectedCredit.credit_type)}`}>
                    {REST_CREDIT_TYPE_LABELS[selectedCredit.credit_type] || selectedCredit.credit_type}
                  </span>
                  <span className="text-sm font-medium">
                    {selectedCredit.remaining_amount.toLocaleString()}원
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedCredit.notes}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="applyYearMonth">적용할 월</Label>
              <Input
                id="applyYearMonth"
                type="month"
                value={applyYearMonth}
                onChange={(e) => setApplyYearMonth(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                해당 월 학원비에서 크레딧 금액만큼 차감됩니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApplyModalOpen(false)}
              disabled={applying}
            >
              취소
            </Button>
            <Button
              onClick={handleApplyCredit}
              disabled={applying || !applyYearMonth}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {applying ? '적용 중...' : '적용'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
