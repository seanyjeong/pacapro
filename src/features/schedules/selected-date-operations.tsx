import Link from 'next/link';
import { CalendarCheck, CheckCircle2, ClipboardCheck, Edit, UserCheck } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { SectionCard, toneIcon } from '@/components/ui/page';
import type { DailyInstructorStats } from '@/lib/api/schedules';
import type { ClassSchedule, TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';
import { cn } from '@/lib/utils';
import { formatDateKorean, getScheduleTitle } from '@/lib/utils/schedule-helpers';
import { TIME_SLOT_META } from './time-slot-meta';

interface SelectedDateOperationsProps {
  instructorStats: Record<string, DailyInstructorStats>;
  schedules: ClassSchedule[];
  selectedDate: string | null;
  onOpenExtraDay: () => void;
  onOpenInstructorAttendance: () => void;
  onSlotClick: (date: string, slot: TimeSlot) => void;
}

export function SelectedDateOperations({
  instructorStats,
  schedules,
  selectedDate,
  onOpenExtraDay,
  onOpenInstructorAttendance,
  onSlotClick,
}: SelectedDateOperationsProps) {
  if (!selectedDate) return null;

  const dailySchedules = schedules.filter((schedule) => schedule.class_date === selectedDate);
  const schedulesBySlot = new Map(dailySchedules.map((schedule) => [schedule.time_slot, schedule]));
  const dailyStats = instructorStats[selectedDate];

  return (
    <SectionCard
      title={formatDateKorean(selectedDate)}
      description="시간대를 눌러 학생·강사 출석을 바로 처리해요."
      actions={
        <div className="hidden gap-1.5 sm:flex">
          <Button size="sm" variant="outline" onClick={onOpenInstructorAttendance}>
            <UserCheck className="h-4 w-4" />
            강사 출근
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenExtraDay}>
            <CheckCircle2 className="h-4 w-4" />
            미배정 출근
          </Button>
        </div>
      }
    >
      <div data-testid="selected-date-operations" className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <Button size="sm" variant="outline" onClick={onOpenInstructorAttendance}>
            <UserCheck className="h-4 w-4" />
            강사 출근
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenExtraDay}>
            <CheckCircle2 className="h-4 w-4" />
            미배정 출근
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {TIME_SLOT_META.map(({ slot, icon: Icon, tone }) => {
            const schedule = schedulesBySlot.get(slot);
            const title = schedule ? getScheduleTitle(schedule) : `${TIME_SLOT_LABELS[slot]} 수업 없음`;
            const stats = dailyStats?.[slot];
            const attended = stats?.attended || 0;
            const scheduled = stats?.scheduled || 0;

            return (
              <div key={slot} className="flex flex-col rounded-xl bg-muted p-4">
                <button
                  type="button"
                  className="-m-1 flex items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-card/60"
                  onClick={() => onSlotClick(selectedDate, slot)}
                  aria-label={`${TIME_SLOT_LABELS[slot]}반 열기`}
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', toneIcon[tone], tone === 'neutral' && 'bg-card')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-foreground">{TIME_SLOT_LABELS[slot]}반</span>
                    <span className={cn('block truncate text-[13px]', schedule ? 'text-secondary-foreground' : 'text-muted-foreground')}>
                      {title}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-extrabold leading-tight text-foreground tabular-nums">
                      {schedule?.student_count || 0}
                      <span className="ml-0.5 text-[13px] font-semibold text-muted-foreground">명</span>
                    </span>
                  </span>
                </button>

                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                  <span>체험 <b className="font-semibold text-secondary-foreground tabular-nums">{schedule?.trial_count || 0}</b>명</span>
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    강사 출근 <b className="font-semibold text-secondary-foreground tabular-nums">{attended}/{scheduled}</b>
                  </span>
                </div>

                {schedule && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <Link
                      className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1 px-2')}
                      href={`/schedules/${schedule.id}/attendance`}
                      aria-label={`${title} 출석 체크`}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      출석
                    </Link>
                    <Link
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1 bg-card px-2')}
                      href={`/schedules/${schedule.id}`}
                      aria-label={`${title} 상세`}
                    >
                      <CalendarCheck className="h-4 w-4" />
                      상세
                    </Link>
                    <Link
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1 bg-card px-2')}
                      href={`/schedules/${schedule.id}/edit`}
                      aria-label={`${title} 수정`}
                    >
                      <Edit className="h-4 w-4" />
                      수정
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
