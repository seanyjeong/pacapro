'use client';

/**
 * 수입 캘린더 뷰 컴포넌트
 * 일자별 수납내역을 달력 형태로 표시
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Banknote, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCalendarGrid,
  isInMonth,
  formatDateToString,
  isToday,
} from '@/lib/utils/schedule-helpers';
import type { Payment } from '@/lib/types/payment';
import { PAYMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types/payment';

interface PaymentCalendarProps {
  payments: Payment[];
  onMonthChange?: (year: number, month: number) => void;
  onPaymentClick?: (id: number) => void;
  initialYear?: number;
  initialMonth?: number;
}

// 날짜별 수입 요약
interface DailyPaymentSummary {
  count: number;
  totalAmount: number;
  payments: Payment[];
}

export function PaymentCalendar({
  payments,
  onMonthChange,
  onPaymentClick,
  initialYear,
  initialMonth,
}: PaymentCalendarProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(initialYear || today.getFullYear(), (initialMonth ? initialMonth - 1 : today.getMonth()), 1)
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarGrid = generateCalendarGrid(year, month);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  // 납부일 기준으로 결제 그룹화 (완납된 것만)
  const paymentsByDate = useMemo(() => {
    const map = new Map<string, DailyPaymentSummary>();

    payments.forEach((payment) => {
      // paid_date가 있는 완납 건만 표시
      if (payment.paid_date && payment.payment_status === 'paid') {
        const date = payment.paid_date;
        if (!map.has(date)) {
          map.set(date, { count: 0, totalAmount: 0, payments: [] });
        }
        const summary = map.get(date)!;
        summary.count++;
        summary.totalAmount += parseFloat(String(payment.paid_amount || payment.final_amount));
        summary.payments.push(payment);
      }
    });

    return map;
  }, [payments]);

  // 선택한 날짜의 결제 목록
  const selectedPayments = useMemo(() => {
    if (!selectedDate) return [];
    return paymentsByDate.get(selectedDate)?.payments || [];
  }, [selectedDate, paymentsByDate]);

  // 월간 총 수입
  const monthlyTotal = useMemo(() => {
    let total = 0;
    paymentsByDate.forEach((summary, date) => {
      // 현재 월의 데이터만 합산
      const dateObj = new Date(date);
      if (dateObj.getFullYear() === year && dateObj.getMonth() === month) {
        total += summary.totalAmount;
      }
    });
    return total;
  }, [paymentsByDate, year, month]);

  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onMonthChange?.(today.getFullYear(), today.getMonth() + 1);
  };

  const handleDateClick = (dateStr: string, inMonth: boolean) => {
    if (!inMonth) return;
    const summary = paymentsByDate.get(dateStr);
    if (summary && summary.count > 0) {
      setSelectedDate(dateStr);
      setDialogOpen(true);
    }
  };

  // 금액 포맷팅 (만원 단위)
  const formatAmount = (amount: number) => {
    if (amount >= 10000) {
      return `${Math.floor(amount / 10000)}만`;
    }
    return amount.toLocaleString();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {year}년 {month + 1}월 수입
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                월간 총 수입: <span className="font-semibold text-green-600">{monthlyTotal.toLocaleString()}원</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
                오늘
              </Button>
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* 요일 헤더 */}
            {weekdays.map((day, index) => (
              <div
                key={day}
                className={cn(
                  'text-center text-sm font-semibold py-2',
                  index === 0 && 'text-red-600',
                  index === 6 && 'text-blue-600'
                )}
              >
                {day}
              </div>
            ))}

            {/* 캘린더 그리드 */}
            {calendarGrid.map((date, index) => {
              const dateStr = formatDateToString(date);
              const daySummary = paymentsByDate.get(dateStr);
              const inMonth = isInMonth(date, year, month);
              const todayFlag = isToday(dateStr);
              const hasPayments = daySummary && daySummary.count > 0;

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(dateStr, inMonth)}
                  disabled={!inMonth || !hasPayments}
                  className={cn(
                    'min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 rounded-lg border text-left transition-colors',
                    inMonth && hasPayments && 'hover:bg-accent hover:border-accent-foreground cursor-pointer',
                    !inMonth && 'bg-muted/50 text-muted-foreground',
                    todayFlag && 'bg-primary/10 border-primary',
                    !hasPayments && inMonth && 'cursor-default'
                  )}
                >
                  <div className="flex flex-col h-full">
                    <div
                      className={cn(
                        'text-sm font-medium mb-1',
                        index % 7 === 0 && 'text-red-600',
                        index % 7 === 6 && 'text-blue-600',
                        !inMonth && 'text-muted-foreground'
                      )}
                    >
                      {date.getDate()}
                    </div>

                    {/* 수입 표시 */}
                    {hasPayments && inMonth && (
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            {daySummary.count}건
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">
                          {formatAmount(daySummary.totalAmount)}원
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 상세 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              {selectedDate && new Date(selectedDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })} 수입
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {/* 일일 총계 */}
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">총 {selectedPayments.length}건</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {selectedPayments.reduce((sum, p) => sum + parseFloat(String(p.paid_amount || p.final_amount)), 0).toLocaleString()}원
                </span>
              </div>
            </div>

            {/* 결제 목록 */}
            <div className="space-y-2">
              {selectedPayments.map((payment) => (
                <div
                  key={payment.id}
                  onClick={() => {
                    if (onPaymentClick) {
                      setDialogOpen(false);
                      onPaymentClick(payment.id);
                    }
                  }}
                  className={cn(
                    'p-3 border rounded-lg',
                    onPaymentClick && 'cursor-pointer hover:bg-accent'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{payment.student_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}
                        {payment.payment_method && (
                          <span className="ml-2">
                            · {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        {parseFloat(String(payment.paid_amount || payment.final_amount)).toLocaleString()}원
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.year_month}
                      </div>
                    </div>
                  </div>
                  {payment.description && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {payment.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
