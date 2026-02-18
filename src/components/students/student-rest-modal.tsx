/**
 * 휴원 처리 모달
 * 학생을 휴원 처리할 때 크레딧/환불 옵션을 선택
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, AlertCircle, Banknote, CreditCard, Ban } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import { paymentsAPI } from '@/lib/api/payments';

interface StudentRestModalProps {
  open: boolean;
  onClose: () => void;
  student: {
    id: number;
    name: string;
    monthly_tuition: string;
    weekly_count: number;
  };
  onSuccess: () => void;
}

type CreditType = 'carryover' | 'refund' | 'none';

export function StudentRestModal({
  open,
  onClose,
  student,
  onSuccess,
}: StudentRestModalProps) {
  const today = new Date().toISOString().split('T')[0];

  const [restStartDate, setRestStartDate] = useState(today);
  const [restEndDate, setRestEndDate] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(true);
  const [restReason, setRestReason] = useState('');
  const [creditType, setCreditType] = useState<CreditType>('none');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | null>(null); // 해당 월 납부 금액
  const [loadingPayment, setLoadingPayment] = useState(false);

  // 예상 크레딧 금액 계산
  const calculateCreditAmount = () => {
    const startDate = new Date(restStartDate);
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 휴원 시작일부터 월말까지 일수
    const endDate = isIndefinite
      ? new Date(year, month + 1, 0)
      : (restEndDate ? new Date(restEndDate) : new Date(year, month + 1, 0));

    const effectiveEnd = endDate < new Date(year, month + 1, 0) ? endDate : new Date(year, month + 1, 0);
    const restDays = Math.ceil((effectiveEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 납부한 금액이 없으면 환불금 0원
    if (paidAmount === null || paidAmount <= 0) {
      return { creditAmount: 0, restDays, daysInMonth, isPaid: false };
    }

    // 납부한 금액 기준으로 일할 계산
    const dailyRate = paidAmount / daysInMonth;
    const creditAmount = Math.floor((dailyRate * restDays) / 1000) * 1000; // 천원 단위 절삭

    return { creditAmount, restDays, daysInMonth, isPaid: true };
  };

  const { creditAmount, restDays, daysInMonth, isPaid } = calculateCreditAmount();

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setRestStartDate(today);
      setRestEndDate('');
      setIsIndefinite(true);
      setRestReason('');
      setCreditType('none');
      setError('');
      setPaidAmount(null);
    }
  }, [open, today]);

  // 해당 월 결제 내역 조회
  useEffect(() => {
    if (!open || !restStartDate) return;

    const fetchPayment = async () => {
      setLoadingPayment(true);
      try {
        const startDate = new Date(restStartDate);
        const year = startDate.getFullYear();
        const month = startDate.getMonth() + 1; // 1-12

        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const payments = await paymentsAPI.getPayments({
          student_id: student.id,
          year_month: yearMonth,
        });

        // 해당 월의 paid 상태인 결제 금액 합산
        const paidPayments = payments.filter(
          (p: any) => p.payment_status === 'paid'
        );

        const totalPaid = paidPayments.reduce(
          (sum: number, p: any) => sum + (p.paid_amount || 0),
          0
        );

        setPaidAmount(totalPaid);
      } catch (err) {
        console.error('결제 내역 조회 실패:', err);
        setPaidAmount(0);
      } finally {
        setLoadingPayment(false);
      }
    };

    fetchPayment();
  }, [open, restStartDate, student.id]);

  const handleSubmit = async () => {
    if (!restStartDate) {
      setError('휴원 시작일을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await studentsAPI.processRest(student.id, {
        rest_start_date: restStartDate,
        rest_end_date: isIndefinite ? null : restEndDate || null,
        rest_reason: restReason || undefined,
        credit_type: creditType,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('휴원 처리 실패:', err);
      setError(err.response?.data?.message || '휴원 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6">
          <CardTitle className="text-lg">⏸️ 휴원 처리</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="py-4 px-6 space-y-6">
          {/* 학생 정보 */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">학생</div>
            <div className="font-medium">{student.name}</div>
            <div className="text-sm text-muted-foreground mt-1">
              월 수업료: {parseInt(student.monthly_tuition).toLocaleString()}원 / 주 {student.weekly_count}회
            </div>
          </div>

          {/* 휴원 기간 */}
          <div className="space-y-4">
            <h4 className="font-medium">휴원 기간</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">시작일</label>
                <input
                  type="date"
                  value={restStartDate}
                  onChange={(e) => setRestStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1">종료일</label>
                <input
                  type="date"
                  value={restEndDate}
                  onChange={(e) => setRestEndDate(e.target.value)}
                  disabled={isIndefinite}
                  className={`w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    isIndefinite ? 'opacity-50' : ''
                  }`}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isIndefinite}
                onChange={(e) => {
                  setIsIndefinite(e.target.checked);
                  if (e.target.checked) setRestEndDate('');
                }}
                className="rounded border-border"
              />
              무기한 휴원
            </label>
          </div>

          {/* 휴원 사유 */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1">휴원 사유</label>
            <input
              type="text"
              value={restReason}
              onChange={(e) => setRestReason(e.target.value)}
              placeholder="예: 개인 사정, 부상, 학업 등"
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 수업료 처리 옵션 */}
          <div className="space-y-3">
            <h4 className="font-medium">수업료 처리</h4>

            {loadingPayment ? (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>결제 내역 확인 중...</span>
                </div>
              </div>
            ) : !isPaid ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    해당 월 납부 내역이 없습니다. 환불/이월 금액: <strong>0원</strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    납부액 {paidAmount?.toLocaleString()}원 기준, {restDays}일 / {daysInMonth}일 = 예상 금액: <strong>{creditAmount.toLocaleString()}원</strong>
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {/* 이월 */}
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                  !isPaid
                    ? 'opacity-50 cursor-not-allowed'
                    : creditType === 'carryover'
                    ? 'border-primary bg-primary/5 cursor-pointer'
                    : 'border-border hover:border-muted-foreground cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="creditType"
                  value="carryover"
                  checked={creditType === 'carryover'}
                  onChange={() => isPaid && setCreditType('carryover')}
                  disabled={!isPaid}
                  className="hidden"
                />
                <CreditCard className={`w-5 h-5 ${creditType === 'carryover' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <div className="font-medium">크레딧 이월</div>
                  <div className="text-sm text-muted-foreground">다음 달 수업료에서 차감</div>
                </div>
                {creditType === 'carryover' && (
                  <div className="text-primary font-medium">{creditAmount.toLocaleString()}원</div>
                )}
              </label>

              {/* 환불 */}
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                  !isPaid
                    ? 'opacity-50 cursor-not-allowed'
                    : creditType === 'refund'
                    ? 'border-primary bg-primary/5 cursor-pointer'
                    : 'border-border hover:border-muted-foreground cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="creditType"
                  value="refund"
                  checked={creditType === 'refund'}
                  onChange={() => isPaid && setCreditType('refund')}
                  disabled={!isPaid}
                  className="hidden"
                />
                <Banknote className={`w-5 h-5 ${creditType === 'refund' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <div className="font-medium">환불</div>
                  <div className="text-sm text-muted-foreground">지출관리에 환불(대기)로 등록됨</div>
                </div>
                {creditType === 'refund' && (
                  <div className="text-primary font-medium">{creditAmount.toLocaleString()}원</div>
                )}
              </label>

              {/* 없음 */}
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  creditType === 'none'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="creditType"
                  value="none"
                  checked={creditType === 'none'}
                  onChange={() => setCreditType('none')}
                  className="hidden"
                />
                <Ban className={`w-5 h-5 ${creditType === 'none' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <div className="font-medium">처리 안 함</div>
                  <div className="text-sm text-muted-foreground">수업료 관련 처리 없음</div>
                </div>
              </label>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                '휴원 처리'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
