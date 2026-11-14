import { Calendar, PanelRightClose, PanelRightOpen, UserCheck } from 'lucide-react';
import type { DailyInstructorStats } from '@/lib/api/schedules';

interface SchedulesPanelToggleProps {
  expanded: boolean;
  instructorStats?: DailyInstructorStats;
  mode?: 'bar' | 'rail';
  scheduleCount?: number;
  onToggle: () => void;
}

export function SchedulesPanelToggle({ expanded, instructorStats, mode = 'rail', scheduleCount = 0, onToggle }: SchedulesPanelToggleProps) {
  if (expanded) {
    const title = mode === 'bar' ? '강사 근무 배정 접기' : '패널 접기';

    return (
      <button
        className="mb-2 flex h-10 w-full items-center justify-center rounded-xl bg-card text-sm font-semibold text-secondary-foreground transition hover:text-foreground"
        title={title}
        type="button"
        onClick={onToggle}
      >
        <PanelRightClose className="mr-2 h-4 w-4" />
        접기
      </button>
    );
  }

  const attendedCount =
    (instructorStats?.morning.attended ?? 0) +
    (instructorStats?.afternoon.attended ?? 0) +
    (instructorStats?.evening.attended ?? 0);

  if (mode === 'bar') {
    return (
      <button
        className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-[15px] text-foreground transition hover:bg-card/70"
        title="강사 근무 배정 펼치기"
        type="button"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 font-semibold">
          <PanelRightOpen className="h-4 w-4" />
          강사 근무 배정
        </span>
        <span className="flex items-center gap-3 text-[13px] font-semibold text-muted-foreground tabular-nums">
          <span className="flex items-center gap-1">
            <UserCheck className="h-4 w-4" />
            {attendedCount}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {scheduleCount}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      className="flex h-full flex-col items-center gap-3 rounded-2xl bg-card px-2 py-4 text-secondary-foreground transition hover:text-foreground"
      title="강사 근무 패널 펼치기"
      type="button"
      onClick={onToggle}
    >
      <PanelRightOpen className="h-4 w-4" />
      <span className="flex flex-col items-center gap-1 text-xs font-semibold tabular-nums">
        <UserCheck className="h-4 w-4" />
        {attendedCount}
      </span>
      <span className="flex flex-col items-center gap-1 text-xs font-semibold tabular-nums">
        <Calendar className="h-4 w-4" />
        {scheduleCount}
      </span>
    </button>
  );
}
