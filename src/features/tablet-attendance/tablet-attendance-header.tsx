import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TimeSlot } from '@/lib/types/schedule';
import { TABLET_TIME_SLOTS } from './tablet-attendance-constants';
import type { TabletAttendanceStats } from './tablet-attendance-types';

interface TabletAttendanceHeaderProps {
  dateLabel: string;
  isToday: boolean;
  loading: boolean;
  stats: TabletAttendanceStats;
  timeSlot: TimeSlot;
  onNextDate: () => void;
  onPreviousDate: () => void;
  onRefresh: () => void;
  onTimeSlotChange: (timeSlot: TimeSlot) => void;
}

export function TabletAttendanceHeader({
  dateLabel,
  isToday,
  loading,
  stats,
  timeSlot,
  onNextDate,
  onPreviousDate,
  onRefresh,
  onTimeSlotChange,
}: TabletAttendanceHeaderProps) {
  return (
    <header className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onPreviousDate} aria-label="이전 날짜">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">출석체크</h1>
            {isToday && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">오늘</span>}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{dateLabel} · {stats.present}/{stats.total} 출석</p>
        </div>
        <Button variant="outline" size="icon" onClick={onNextDate} aria-label="다음 날짜">
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="출석 새로고침" disabled={loading}>
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="수업 시간대">
        {TABLET_TIME_SLOTS.map((slot) => (
          <button
            type="button"
            key={slot.value}
            role="tab"
            aria-selected={timeSlot === slot.value}
            onClick={() => onTimeSlotChange(slot.value)}
            className={`rounded-lg border px-4 py-3 text-base font-medium transition
              ${timeSlot === slot.value
                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'}`}
          >
            {slot.label}
          </button>
        ))}
      </div>
    </header>
  );
}
