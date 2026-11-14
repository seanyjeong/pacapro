import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Consultation } from '@/lib/types/consultation';
import { ConsultationCalendarGrid } from './consultation-calendar-grid';
import { ConsultationCalendarLegend } from './consultation-calendar-legend';
import type { StudentConsultationMemo } from './consultation-calendar-types';

interface ConsultationCalendarMonthCardProps {
  currentMonth: Date;
  loading: boolean;
  calendarDays: Date[];
  startPadding: number;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  getConsultationsForDate: (date: Date) => Consultation[];
  getMemosForDate: (date: Date) => StudentConsultationMemo[];
  onDateClick: (date: Date) => void;
  onCreateLearning: (date: Date) => void;
}

export function ConsultationCalendarMonthCard({
  currentMonth,
  loading,
  calendarDays,
  startPadding,
  onPreviousMonth,
  onNextMonth,
  getConsultationsForDate,
  getMemosForDate,
  onDateClick,
  onCreateLearning,
}: ConsultationCalendarMonthCardProps) {
  return (
    <section className="rounded-2xl bg-card px-3 pb-4 pt-4 sm:px-6 sm:pb-6" data-testid="consultation-calendar-month-card">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPreviousMonth} aria-label="이전 달">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-extrabold tracking-tight text-foreground tabular-nums">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>
        <Button variant="ghost" size="icon" onClick={onNextMonth} aria-label="다음 달">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <ConsultationCalendarGrid
            calendarDays={calendarDays}
            startPadding={startPadding}
            getConsultationsForDate={getConsultationsForDate}
            getMemosForDate={getMemosForDate}
            onDateClick={onDateClick}
            onCreateLearning={onCreateLearning}
          />
          <ConsultationCalendarLegend />
        </div>
      )}
    </section>
  );
}
