import Link from 'next/link';
import { ChevronLeft, ChevronRight, RefreshCw, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';
import type { TimeSlot } from '@/lib/types/schedule';
import { ATTENDANCE_TEST_NOTIFICATION_HREF } from '@/lib/constants/notification-links';
import { TABLET_TIME_SLOTS } from './tablet-attendance-constants';

interface TabletAttendanceHeaderProps {
  dateLabel: string;
  isToday: boolean;
  loading: boolean;
  timeSlot: TimeSlot;
  roster: React.ReactNode;
  onNextDate: () => void;
  onPreviousDate: () => void;
  onRefresh: () => void;
  onTimeSlotChange: (timeSlot: TimeSlot) => void;
}

export function TabletAttendanceHeader({
  dateLabel,
  isToday,
  loading,
  timeSlot,
  roster,
  onNextDate,
  onPreviousDate,
  onRefresh,
  onTimeSlotChange,
}: TabletAttendanceHeaderProps) {
  return (
    <>
      <PageHeader
        title={(
          <span className="flex items-center gap-2">
            출석체크
            {isToday && <Badge variant="success" className="text-[13px]">오늘</Badge>}
          </span>
        )}
        description={dateLabel}
        actions={(
          <>
            <Button variant="outline" size="icon" onClick={onPreviousDate} aria-label="이전 날짜">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={onNextDate} aria-label="다음 날짜">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={onRefresh} aria-label="출석 새로고침" disabled={loading}>
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Link className={buttonVariants({ variant: 'outline' })} href={ATTENDANCE_TEST_NOTIFICATION_HREF}>
              <Send className="h-4 w-4" />
              출결 테스트발송
            </Link>
          </>
        )}
      />

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 lg:flex-row lg:items-center" aria-label="수업 고르기">
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="수업 시간대">
          {TABLET_TIME_SLOTS.map((slot) => (
            <button
              type="button"
              key={slot.value}
              role="tab"
              aria-selected={timeSlot === slot.value}
              onClick={() => onTimeSlotChange(slot.value)}
              className={cn(
                'h-11 rounded-lg text-base font-semibold transition-colors',
                timeSlot === slot.value ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {slot.label}
            </button>
          ))}
        </div>
        {roster && <div className="lg:w-80">{roster}</div>}
      </section>
    </>
  );
}
