'use client';

/**
 * 수입 캘린더 뷰 컴포넌트
 * 일자별 수입내역(학원비 수납 + 기타수입)을 달력 형태로 표시
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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Banknote, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCalendarGrid,
  isInMonth,
  formatDateToString,
  isToday,
} from '@/lib/utils/schedule-helpers';

interface OtherIncome {
  id: number;
  income_date: string;
  category: string;
  amount: number;
  student_id?: number;
  student_name?: string;
  description?: string;
  payment_method?: string;
  notes?: string;
}

interface TuitionPayment {
  id: number;
  student_id: number;
  student_name: string;
  year_month: string;
  final_amount: number;
  paid_amount: number;
  paid_date: string;
  payment_method: string;
  payment_status: string;
}

interface IncomeCalendarProps {
  otherIncomes: OtherIncome[];
  tuitionPayments: TuitionPayment[];
  onMonthChange?: (yearMonth: string) => void;
  initialYearMonth?: string;
}

// 날짜별 수입 요약
interface DailyIncomeSummary {
  tuitionCount: number;
  tuitionAmount: number;
  otherCount: number;
  otherAmount: number;
  totalAmount: number;
  tuitionPayments: TuitionPayment[];
  otherIncomes: OtherIncome[];
}

const CATEGORY_MAP: Record<string, string> = {
  clothing: '의류',
  shoes: '신발',
  equipment: '용품',
  beverage: '음료',
  snack: '간식',
  other: '기타',
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: '현금',
  card: '카드',
  transfer: '계좌이체',
  account: '계좌이체',
};

export function IncomeCalendar({
  otherIncomes,
  tuitionPayments,
  onMonthChange,
  initialYearMonth,
}: IncomeCalendarProps) {
  const today = new Date();
  const [year, month] = initialYearMonth
    ? initialYearMonth.split('-').map(Number)
    : [today.getFullYear(), today.getMonth() + 1];

  const [currentDate, setCurrentDate] = useState(new Date(year, month - 1, 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const calendarGrid = generateCalendarGrid(currentYear, currentMonth);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  // 날짜별로 수입 그룹화
  const incomesByDate = useMemo(() => {
    const map = new Map<string, DailyIncomeSummary>();

    // 학원비 수납 (paid_date 기준)
    tuitionPayments.forEach((payment) => {
      if (payment.paid_date) {
        const date = payment.paid_date.split('T')[0];
        if (!map.has(date)) {
          map.set(date, {
            tuitionCount: 0,
            tuitionAmount: 0,
            otherCount: 0,
            otherAmount: 0,
            totalAmount: 0,
            tuitionPayments: [],
            otherIncomes: [],
          });
        }
        const summary = map.get(date)!;
        const amount = Math.floor(parseFloat(String(payment.final_amount)) || 0);
        summary.tuitionCount++;
        summary.tuitionAmount += amount;
        summary.totalAmount += amount;
        summary.tuitionPayments.push(payment);
      }
    });

    // 기타 수입 (income_date 기준)
    otherIncomes.forEach((income) => {
      const date = income.income_date.split('T')[0];
      if (!map.has(date)) {
        map.set(date, {
          tuitionCount: 0,
          tuitionAmount: 0,
          otherCount: 0,
          otherAmount: 0,
          totalAmount: 0,
          tuitionPayments: [],
          otherIncomes: [],
        });
      }
      const summary = map.get(date)!;
      const amount = Math.floor(parseFloat(String(income.amount)) || 0);
      summary.otherCount++;
      summary.otherAmount += amount;
      summary.totalAmount += amount;
      summary.otherIncomes.push(income);
    });

    return map;
  }, [tuitionPayments, otherIncomes]);

  // 선택한 날짜의 수입 내역
  const selectedSummary = useMemo(() => {
    if (!selectedDate) return null;
    return incomesByDate.get(selectedDate) || null;
  }, [selectedDate, incomesByDate]);

  // 월간 총 수입
  const monthlyTotal = useMemo(() => {
    let tuition = 0;
    let other = 0;
    incomesByDate.forEach((summary, date) => {
      const dateObj = new Date(date);
      if (dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth) {
        tuition += summary.tuitionAmount;
        other += summary.otherAmount;
      }
    });
    return { tuition, other, total: tuition + other };
  }, [incomesByDate, currentYear, currentMonth]);

  const handlePrevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    setCurrentDate(newDate);
    const ym = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange?.(ym);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    setCurrentDate(newDate);
    const ym = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange?.(ym);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange?.(ym);
  };

  const handleDateClick = (dateStr: string, inMonth: boolean) => {
    if (!inMonth) return;
    const summary = incomesByDate.get(dateStr);
    if (summary && summary.totalAmount > 0) {
      setSelectedDate(dateStr);
      setDialogOpen(true);
    }
  };

  // 금액 포맷팅 (만원 단위)
  const formatAmount = (amount: number) => {
    if (amount >= 10000) {
      const man = Math.floor(amount / 10000);
      const remainder = amount % 10000;
      if (remainder === 0) return `${man}만`;
      return `${man}.${Math.floor(remainder / 1000)}만`;
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
                {currentYear}년 {currentMonth + 1}월 수입
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-muted-foreground">
                  총 수입: <span className="font-semibold text-green-600">{monthlyTotal.total.toLocaleString()}원</span>
                </span>
                <span className="text-muted-foreground">
                  학원비: <span className="font-medium text-blue-600">{monthlyTotal.tuition.toLocaleString()}원</span>
                </span>
                <span className="text-muted-foreground">
                  기타: <span className="font-medium text-purple-600">{monthlyTotal.other.toLocaleString()}원</span>
                </span>
              </div>
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
              const daySummary = incomesByDate.get(dateStr);
              const inMonth = isInMonth(date, currentYear, currentMonth);
              const todayFlag = isToday(dateStr);
              const hasIncome = daySummary && daySummary.totalAmount > 0;

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(dateStr, inMonth)}
                  disabled={!inMonth || !hasIncome}
                  className={cn(
                    'min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 rounded-lg border text-left transition-colors',
                    inMonth && hasIncome && 'hover:bg-accent hover:border-accent-foreground cursor-pointer',
                    !inMonth && 'bg-muted/50 text-muted-foreground',
                    todayFlag && 'bg-primary/10 border-primary',
                    !hasIncome && inMonth && 'cursor-default'
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
                    {hasIncome && inMonth && (
                      <div className="flex-1 space-y-0.5">
                        {daySummary.tuitionCount > 0 && (
                          <div className="flex items-center gap-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[10px] text-blue-600">{daySummary.tuitionCount}</span>
                          </div>
                        )}
                        {daySummary.otherCount > 0 && (
                          <div className="flex items-center gap-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="text-[10px] text-purple-600">{daySummary.otherCount}</span>
                          </div>
                        )}
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

          {/* 범례 */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>학원비 수납</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>기타 수입</span>
            </div>
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

          <div className="py-6 px-6 space-y-4">
            {/* 일일 총계 */}
            {selectedSummary && (
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">총 수입</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {selectedSummary.totalAmount.toLocaleString()}원
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-blue-600">학원비 {selectedSummary.tuitionCount}건 ({selectedSummary.tuitionAmount.toLocaleString()}원)</span>
                  <span className="text-purple-600">기타 {selectedSummary.otherCount}건 ({selectedSummary.otherAmount.toLocaleString()}원)</span>
                </div>
              </div>
            )}

            {/* 학원비 수납 목록 */}
            {selectedSummary && selectedSummary.tuitionPayments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  학원비 수납
                </h4>
                <div className="space-y-2">
                  {selectedSummary.tuitionPayments.map((payment) => (
                    <div key={payment.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{payment.student_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {payment.year_month} · {PAYMENT_METHOD_MAP[payment.payment_method] || payment.payment_method}
                          </div>
                        </div>
                        <div className="font-semibold text-blue-600">
                          {Math.floor(parseFloat(String(payment.final_amount))).toLocaleString()}원
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 기타 수입 목록 */}
            {selectedSummary && selectedSummary.otherIncomes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Banknote className="w-4 h-4 text-purple-600" />
                  기타 수입
                </h4>
                <div className="space-y-2">
                  {selectedSummary.otherIncomes.map((income) => (
                    <div key={income.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            <Badge variant="secondary" className="mr-2">
                              {CATEGORY_MAP[income.category] || income.category}
                            </Badge>
                            {income.description || '-'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {PAYMENT_METHOD_MAP[income.payment_method || 'cash']}
                            {income.student_name && ` · ${income.student_name}`}
                          </div>
                        </div>
                        <div className="font-semibold text-purple-600">
                          {Math.floor(parseFloat(String(income.amount))).toLocaleString()}원
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
