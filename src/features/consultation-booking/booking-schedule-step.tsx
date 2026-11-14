import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConsultationPageInfo, TimeSlot } from '@/lib/types/consultation';
import { cn } from '@/lib/utils/cn';
import { buildCalendarDays, isBookingDateAvailable } from './booking-utils';
import { BookingActionBar, BookingAlert, BookingCard } from './booking-ui';

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
    <div className="space-y-4">
      <BookingCard title="날짜 선택">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="이전 달"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-secondary-foreground transition-colors hover:bg-muted"
            onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-base font-bold text-foreground">{format(currentMonth, 'yyyy년 M월', { locale: ko })}</p>
          <button
            type="button"
            aria-label="다음 달"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-secondary-foreground transition-colors hover:bg-muted"
            onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[13px] font-semibold text-muted-foreground">
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => <div key={day} className="py-1">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendar.days.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="h-11" />;
            const dateKey = format(date, 'yyyy-MM-dd');
            const available = isBookingDateAvailable(date, calendar.today, calendar.maxDate, pageInfo.weeklyHours);
            const selected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dateKey;
            return (
              <button
                key={dateKey}
                type="button"
                className={cn(
                  'h-11 rounded-xl text-[15px] tabular-nums transition-colors',
                  selected
                    ? 'bg-primary font-bold text-primary-foreground'
                    : available
                      ? 'font-semibold text-foreground hover:bg-primary-soft hover:text-primary'
                      : 'cursor-not-allowed text-muted-foreground/50'
                )}
                data-testid={`booking-date-${dateKey}`}
                disabled={!available}
                onClick={() => onSelectDate(date)}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </BookingCard>

      {selectedDate && (
        <BookingCard title={`${format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })} 가능 시간`}>
          {slotsError && <div className="mb-3"><BookingAlert message={slotsError} /></div>}
          {slotsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableSlots.length === 0 && !slotsError ? (
            <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">예약 가능한 시간이 없어요.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map((slot) => {
                const label = slot.time.slice(0, 5);
                const selected = selectedTime === label;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      'h-12 rounded-xl text-[15px] font-semibold tabular-nums transition-colors',
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-primary-soft hover:text-primary'
                    )}
                    onClick={() => onSelectTime(label)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </BookingCard>
      )}

      <BookingActionBar>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button size="lg" variant="outline" onClick={onBack}>이전</Button>
          <Button size="lg" disabled={!selectedDate || !selectedTime} onClick={onNext}>다음: 확인</Button>
        </div>
      </BookingActionBar>
    </div>
  );
}
