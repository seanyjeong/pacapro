import Link from 'next/link';
import { CalendarCog, ClipboardCheck, ListChecks, UserCog, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import type { ClassSchedule } from '@/lib/types/schedule';
import { cn } from '@/lib/utils';
import { getScheduleTitle, getTimeSlotColor, getTimeSlotLabel } from '@/lib/utils/schedule-helpers';

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
    <section className="rounded-md border border-border bg-background p-4 shadow-none" aria-label="선택일 운영">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{dateLabel}</span>
            {isToday ? <Badge variant="secondary">오늘</Badge> : null}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            {isToday ? '오늘 수업 운영' : '선택일 수업 운영'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">수업, 출석, 강사 배정, 요일 관리를 여기서 바로 이동합니다.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onAssignInstructor} className="gap-2">
            <UserCog className="h-4 w-4" />
            강사 배정
          </Button>
          <Link href="/students/class-days" className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
            <CalendarCog className="h-4 w-4" />
            수업일관리
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <OperationMetric icon={ListChecks} label="수업" value={`${schedules.length}개`} />
        <OperationMetric icon={Users} label="학생" value={`${totalStudents}명`} />
        <OperationMetric icon={ClipboardCheck} label="출석" value={getAttendanceSummary(schedules)} />
      </div>

      <div className="mt-4 space-y-2">
        {schedules.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            선택한 날짜에 수업이 없습니다.
          </div>
        ) : (
          schedules.map((schedule) => <ScheduleOperationRow key={schedule.id} schedule={schedule} />)
        )}
      </div>
    </section>
  );
}

interface OperationMetricProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function OperationMetric({ icon: Icon, label, value }: OperationMetricProps) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ScheduleOperationRow({ schedule }: { schedule: ClassSchedule }) {
  const title = getScheduleTitle(schedule);

  return (
    <article className="rounded-md border border-border bg-background px-3 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('gap-1 font-medium', getTimeSlotColor(schedule.time_slot))}>
              {getTimeSlotLabel(schedule.time_slot)}
            </Badge>
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {schedule.instructor_name || '강사 미정'} · {schedule.student_count || 0}명
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/schedules/${schedule.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            수업 상세
          </Link>
          <Link
            href={`/schedules/${schedule.id}/attendance`}
            aria-label={`${title} 출석 체크`}
            className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}
          >
            <ClipboardCheck className="h-4 w-4" />
            출석 체크
          </Link>
        </div>
      </div>
    </article>
  );
}

function getAttendanceSummary(schedules: ClassSchedule[]): string {
  const completed = schedules.filter((schedule) => schedule.attendance_taken).length;
  return `${completed}/${schedules.length}`;
}
