import type { Consultation } from '@/lib/types/consultation';
import { WEEKDAY_LABELS } from './consultation-calendar-constants';
import { ConsultationCalendarDayCell } from './consultation-calendar-day-cell';
import type { StudentConsultationMemo } from './consultation-calendar-types';

interface ConsultationCalendarGridProps {
  calendarDays: Date[];
  startPadding: number;
  getConsultationsForDate: (date: Date) => Consultation[];
  getMemosForDate: (date: Date) => StudentConsultationMemo[];
  onDateClick: (date: Date) => void;
  onCreateLearning: (date: Date) => void;
}

export function ConsultationCalendarGrid({
  calendarDays,
  startPadding,
  getConsultationsForDate,
  getMemosForDate,
  onDateClick,
  onCreateLearning,
}: ConsultationCalendarGridProps) {
  return (
    <>
      <div className="mb-2 grid grid-cols-7">
        {WEEKDAY_LABELS.map((day, index) => (
          <div
            key={day}
            className={`py-2 text-center text-sm font-medium ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPadding }).map((_, index) => (
          <div key={`pad-${index}`} className="min-h-[74px] sm:min-h-[96px]" />
        ))}
        {calendarDays.map((date) => (
          <ConsultationCalendarDayCell
            key={date.toISOString()}
            date={date}
            consultations={getConsultationsForDate(date)}
            memos={getMemosForDate(date)}
            onDateClick={onDateClick}
            onCreateLearning={onCreateLearning}
          />
        ))}
      </div>
    </>
  );
}
