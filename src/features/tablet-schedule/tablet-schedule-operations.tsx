import Link from 'next/link';
import { CalendarCog, ClipboardCheck, ListChecks, UserCog, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { SectionCard, StatTile, toneIcon } from '@/components/ui/page';
import { TIME_SLOT_BADGE, TIME_SLOT_META } from '@/features/schedules/time-slot-meta';
import type { ClassSchedule } from '@/lib/types/schedule';
import { cn } from '@/lib/utils/cn';
import { getScheduleTitle, getTimeSlotLabel } from '@/lib/utils/schedule-helpers';

interface TabletScheduleOperationsProps {
  dateLabel: string;
  isToday: boolean;
  schedules: ClassSchedule[];
  totalStudents: number;
  onAssignInstructor: () => void;
}

export function TabletScheduleOperations({
  dateLabel,
  isToday,
  schedules,
  totalStudents,
  onAssignInstructor,
}: TabletScheduleOperationsProps) {
  return (
    <>
      <section className="grid grid-cols-3 gap-3" aria-label="선택일 숫자 요약">
        <StatTile icon={ListChecks} label="수업" tone="primary" value={`${schedules.length}개`} />
        <StatTile icon={Users} label="학생" tone="success" value={`${totalStudents}명`} />
        <StatTile icon={ClipboardCheck} label="출석 완료" value={getAttendanceSummary(schedules)} />
      </section>

      <SectionCard
        title={(
          <span className="flex items-center gap-2">
            {isToday ? '오늘 수업 운영' : '선택일 수업 운영'}
            {isToday ? <Badge variant="default">오늘</Badge> : null}
          </span>
        )}
        description={`${dateLabel} · 수업, 출석, 강사 배정, 요일 관리로 바로 이동해요.`}
        actions={(
          <>
            <Button type="button" size="sm" variant="outline" onClick={onAssignInstructor}>
              <UserCog className="h-4 w-4" />
              강사 배정
            </Button>
            <Link href="/students/class-days" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              <CalendarCog className="h-4 w-4" />
              수업일관리
            </Link>
          </>
        )}
      >
        <div aria-label="선택일 운영">
          {schedules.length === 0 ? (
            <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
              선택한 날짜에 수업이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {schedules.map((schedule) => <ScheduleOperationRow key={schedule.id} schedule={schedule} />)}
            </ul>
          )}
        </div>
      </SectionCard>
    </>
  );
}

function ScheduleOperationRow({ schedule }: { schedule: ClassSchedule }) {
  const title = getScheduleTitle(schedule);
  const meta = TIME_SLOT_META.find((item) => item.slot === schedule.time_slot);
  const Icon = meta?.icon;

  return (
    <li className="flex items-center gap-3 py-3.5">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', toneIcon[meta?.tone || 'neutral'])}>
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-foreground">{title}</span>
          <Badge variant={TIME_SLOT_BADGE[schedule.time_slot]}>{getTimeSlotLabel(schedule.time_slot)}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {schedule.instructor_name || '강사 미정'} · {schedule.student_count || 0}명
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Link href={`/schedules/${schedule.id}`} className={buttonVariants({ variant: 'outline' })}>
          수업 상세
        </Link>
        <Link
          href={`/schedules/${schedule.id}/attendance`}
          aria-label={`${title} 출석 체크`}
          className={buttonVariants({})}
        >
          <ClipboardCheck className="h-4 w-4" />
          출석 체크
        </Link>
      </div>
    </li>
  );
}

function getAttendanceSummary(schedules: ClassSchedule[]): string {
  const completed = schedules.filter((schedule) => schedule.attendance_taken).length;
  return `${completed}/${schedules.length}`;
}
