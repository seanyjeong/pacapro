'use client';

/**
 * 지출 캘린더 뷰 컴포넌트
 * 일자별 지출내역을 달력 형태로 표시
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCalendarGrid,
  isInMonth,
  formatDateToString,
  isToday,
} from '@/lib/utils/schedule-helpers';

interface Expense {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  instructor_id?: number;
  instructor_name?: string;
  salary_id?: number;
  description?: string;
  payment_method?: string;
  notes?: string;
}

interface ExpenseCalendarProps {
  expenses: Expense[];
  onMonthChange?: (yearMonth: string) => void;
  initialYearMonth?: string;
}

// 날짜별 지출 요약
interface DailyExpenseSummary {
  count: number;
  totalAmount: number;
  expenses: Expense[];
}

const CATEGORY_MAP: Record<string, string> = {
  salary: '급여',
  utilities: '공과금',
  rent: '임대료',
  supplies: '소모품',
  marketing: '홍보비',
  refund: '환불',
  '환불': '환불',
  '환불(대기)': '환불(대기)',
  other: '기타',
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: '현금',
  card: '카드',
  account: '계좌이체',
  other: '기타',
};

export function ExpenseCalendar({
  expenses,
  onMonthChange,
  initialYearMonth,
}: ExpenseCalendarProps) {
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

  // 날짜별로 지출 그룹화
  const expensesByDate = useMemo(() => {
    const map = new Map<string, DailyExpenseSummary>();

    expenses.forEach((expense) => {
      const date = expense.expense_date.split('T')[0];
      if (!map.has(date)) {
        map.set(date, { count: 0, totalAmount: 0, expenses: [] });
      }
      const summary = map.get(date)!;
      const amount = Math.floor(parseFloat(String(expense.amount)) || 0);
      summary.count++;
      summary.totalAmount += amount;
      summary.expenses.push(expense);
    });

    return map;
  }, [expenses]);

  // 선택한 날짜의 지출 내역
  const selectedSummary = useMemo(() => {
    if (!selectedDate) return null;
    return expensesByDate.get(selectedDate) || null;
  }, [selectedDate, expensesByDate]);

  // 월간 총 지출
  const monthlyTotal = useMemo(() => {
    let total = 0;
    expensesByDate.forEach((summary, date) => {
      const dateObj = new Date(date);
      if (dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth) {
        total += summary.totalAmount;
      }
    });
    return total;
  }, [expensesByDate, currentYear, currentMonth]);

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
    const summary = expensesByDate.get(dateStr);
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
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-foreground">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              {currentYear}년 {currentMonth + 1}월 지출
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              월간 총 지출 <span className="font-bold tabular-nums text-destructive">{monthlyTotal.toLocaleString()}원</span>
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" onClick={handleToday}>
              오늘
            </Button>
            <Button variant="outline" size="icon-sm" onClick={handlePrevMonth} aria-label="이전 달">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={handleNextMonth} aria-label="다음 달">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {/* 요일 헤더 */}
            {weekdays.map((day, index) => (
              <div
                key={day}
                className={cn(
                  'py-2 text-center text-[13px] font-semibold text-muted-foreground',
                  index === 0 && 'text-destructive',
                  index === 6 && 'text-primary'
                )}
              >
                {day}
              </div>
            ))}

            {/* 캘린더 그리드 */}
            {calendarGrid.map((date, index) => {
              const dateStr = formatDateToString(date);
              const daySummary = expensesByDate.get(dateStr);
              const inMonth = isInMonth(date, currentYear, currentMonth);
              const todayFlag = isToday(dateStr);
              const hasExpense = daySummary && daySummary.totalAmount > 0;

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(dateStr, inMonth)}
                  disabled={!inMonth || !hasExpense}
                  className={cn(
                    'min-h-[72px] min-w-0 rounded-xl bg-muted/60 p-1 text-left transition-colors sm:min-h-[96px] sm:p-2',
                    inMonth && hasExpense && 'cursor-pointer bg-destructive-soft/60 hover:bg-destructive-soft',
                    !inMonth && 'bg-transparent text-muted-foreground opacity-50',
                    todayFlag && 'bg-primary-soft ring-2 ring-inset ring-primary',
                    !hasExpense && inMonth && 'cursor-default'
                  )}
                >
                  <div className="flex flex-col h-full">
                    <div
                      className={cn(
                        'mb-1 text-sm font-semibold tabular-nums',
                        index % 7 === 0 && 'text-destructive',
                        index % 7 === 6 && 'text-primary',
                        !inMonth && 'text-muted-foreground'
                      )}
                    >
                      {date.getDate()}
                    </div>

                    {/* 지출 표시 */}
                    {hasExpense && inMonth && (
                      <div className="flex-1 space-y-0.5">
                        <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
                          {daySummary.count}건
                        </Badge>
                        <div className="truncate text-[11px] font-bold tabular-nums text-destructive sm:text-sm">
                          -{formatAmount(daySummary.totalAmount)}원
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 상세 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-destructive" />
              {selectedDate && new Date(selectedDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })} 지출
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 px-6 space-y-4">
            {/* 일일 총계 */}
            {selectedSummary && (
              <div className="rounded-xl bg-destructive-soft p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">총 {selectedSummary.count}건</span>
                  <span className="text-lg font-extrabold tabular-nums text-destructive">
                    -{selectedSummary.totalAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            )}

            {/* 지출 목록 */}
            {selectedSummary && (
              <div className="space-y-2">
                {selectedSummary.expenses.map((expense) => (
                  <div key={expense.id} className="rounded-xl bg-muted p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Badge variant="secondary">
                            {CATEGORY_MAP[expense.category] || expense.category}
                          </Badge>
                          {expense.description || '-'}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {PAYMENT_METHOD_MAP[expense.payment_method || 'cash']}
                          {expense.instructor_name && ` · ${expense.instructor_name}`}
                        </div>
                      </div>
                      <div className="shrink-0 font-bold tabular-nums text-destructive">
                        -{Math.floor(parseFloat(String(expense.amount))).toLocaleString()}원
                      </div>
                    </div>
                    {expense.notes && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {expense.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
