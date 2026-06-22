import { Calendar, PanelRightClose, PanelRightOpen, UserCheck } from 'lucide-react';
import type { DailyInstructorStats } from '@/lib/api/schedules';

interface SchedulesPanelToggleProps {
  expanded: boolean;
  instructorStats?: DailyInstructorStats;
  scheduleCount?: number;
  onToggle: () => void;
}

export function SchedulesPanelToggle({ expanded, instructorStats, scheduleCount = 0, onToggle }: SchedulesPanelToggleProps) {
  if (expanded) {
    return (
      <button
        className="mb-2 flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 transition hover:bg-slate-100"
        title="패널 접기"
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

  return (
    <button
      className="flex h-full flex-col items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-4 text-slate-600 transition hover:bg-slate-100"
      title="강사 근무 배정 펼치기"
      type="button"
      onClick={onToggle}
    >
      <PanelRightOpen className="h-4 w-4" />
      <span className="flex flex-col items-center gap-1 text-xs font-medium">
        <UserCheck className="h-4 w-4" />
        {attendedCount}
      </span>
      <span className="flex flex-col items-center gap-1 text-xs font-medium">
        <Calendar className="h-4 w-4" />
        {scheduleCount}
      </span>
    </button>
  );
}
