import Link from 'next/link';
import { ArrowLeft, Calendar, RefreshCw, Send } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ATTENDANCE_TEST_NOTIFICATION_HREF } from '@/lib/constants/notification-links';
import type { TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_OPTIONS } from './mobile-attendance-constants';
import type { AttendanceStats } from './mobile-attendance-types';

interface MobileAttendanceHeaderProps {
  date: string;
  formattedDate: string;
  loading: boolean;
  stats: AttendanceStats;
  timeSlot: TimeSlot;
  onBack: () => void;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onTimeSlotChange: (timeSlot: TimeSlot) => void;
}

export function MobileAttendanceHeader({
  date,
  formattedDate,
  loading,
  stats,
  timeSlot,
  onBack,
  onDateChange,
  onRefresh,
  onTimeSlotChange,
}: MobileAttendanceHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="모바일 홈으로 이동" className="-ml-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-normal text-foreground">학생 출석체크</h1>
          <p className="truncate text-sm text-muted-foreground">
            {formattedDate} · {stats.present}/{stats.total} 출석
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="출석 목록 새로고침" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-muted-foreground/40 dark:[color-scheme:dark]"
          aria-label="출석 날짜"
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2" role="tablist" aria-label="수업 시간대">
        {TIME_SLOT_OPTIONS.map((slot) => (
          <button
            key={slot.value}
            type="button"
            onClick={() => onTimeSlotChange(slot.value)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition
              ${timeSlot === slot.value
                ? 'border-muted-foreground/40 bg-foreground text-white'
                : 'border-border bg-muted text-secondary-foreground'}`}
            aria-selected={timeSlot === slot.value}
            role="tab"
          >
            {slot.label}
          </button>
        ))}
      </div>

      <Link
        className={buttonVariants({
          variant: 'outline',
          className: 'mt-3 h-10 w-full justify-center gap-2 border-border bg-card',
        })}
        href={ATTENDANCE_TEST_NOTIFICATION_HREF}
      >
        <Send className="h-4 w-4" />
        출결 테스트발송
      </Link>
    </header>
  );
}
