import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConsultationPageInfo, TimeSlot } from '@/lib/types/consultation';
import { buildCalendarDays, isBookingDateAvailable } from './booking-utils';

interface BookingScheduleStepProps {
  currentMonth: Date;
  onBack: () => void;
  onMonthChange: (date: Date) => void;
  onNext: () => void;
  onSelectDate: (date: Date) => void;
  onSelectTime: (time: string) => void;
  pageInfo: ConsultationPageInfo;
  selectedDate: Date | null;
  selectedTime: string;
  slots: TimeSlot[];
  slotsError: string | null;
  slotsLoading: boolean;
}

export function BookingScheduleStep({
  currentMonth,
  onBack,
  onMonthChange,
  onNext,
  onSelectDate,
  onSelectTime,
  pageInfo,
  selectedDate,
  selectedTime,
  slots,
  slotsError,
  slotsLoading,
}: BookingScheduleStepProps) {
  const calendar = buildCalendarDays(currentMonth, pageInfo.settings.advanceDays);
  const availableSlots = slots.filter((slot) => slot.available);

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Calendar className="h-4 w-4" />
          일정 선택
        </h2>
        <Button size="sm" variant="outline" onClick={onBack}>이전</Button>
      </div>
      <div className="space-y-5 p-4">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-3 flex items-center justify-between">
            <button className="rounded-md p-1 hover:bg-slate-100" onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold text-slate-950">{format(currentMonth, 'yyyy년 M월', { locale: ko })}</p>
            <button className="rounded-md p-1 hover:bg-slate-100" onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendar.days.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} className="h-10" />;
              const dateKey = format(date, 'yyyy-MM-dd');
              const available = isBookingDateAvailable(date, calendar.today, calendar.maxDate, pageInfo.weeklyHours);
              const selected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dateKey;
              return (
                <button
                  key={dateKey}
                  className={`h-10 rounded-md text-sm transition-colors ${selected ? 'bg-blue-600 font-semibold text-white' : available ? 'text-slate-700 hover:bg-blue-50' : 'cursor-not-allowed text-slate-300'}`}
                  data-testid={`booking-date-${dateKey}`}
                  disabled={!available}
                  onClick={() => onSelectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Clock className="h-4 w-4" />
              {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })} 가능 시간
            </h3>
            {slotsError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {slotsError}
              </div>
            )}
            {slotsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : availableSlots.length === 0 && !slotsError ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">예약 가능한 시간이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot) => {
                  const label = slot.time.slice(0, 5);
                  return (
                    <button
                      key={slot.time}
                      className={`h-10 rounded-md text-sm font-semibold transition-colors ${selectedTime === label ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-blue-50'}`}
                      onClick={() => onSelectTime(label)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Button className="w-full" disabled={!selectedDate || !selectedTime} onClick={onNext}>다음: 확인</Button>
      </div>
    </section>
  );
}
