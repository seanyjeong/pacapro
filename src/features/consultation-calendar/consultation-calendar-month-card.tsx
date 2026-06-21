import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="text-xl">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
      </CardContent>
    </Card>
  );
}
