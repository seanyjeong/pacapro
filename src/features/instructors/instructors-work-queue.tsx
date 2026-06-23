import Link from 'next/link';
import { Banknote, CalendarDays, ClipboardCheck, Plus, Smartphone, UserCheck, Users, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Instructor } from '@/lib/types/instructor';

interface InstructorsWorkQueueProps {
  currentCount: number;
  instructors: Instructor[];
  onAddInstructor: () => void;
}

export function InstructorsWorkQueue({
  currentCount,
  instructors,
  onAddInstructor,
}: InstructorsWorkQueueProps) {
  const activeCount = instructors.filter((instructor) => instructor.status === 'active').length;
  const leaveCount = instructors.filter((instructor) => instructor.status === 'on_leave').length;
  const hourlyCount = instructors.filter((instructor) => instructor.salary_type === 'hourly').length;
  const monthlyCount = instructors.filter((instructor) => instructor.salary_type === 'monthly').length;
  const perClassCount = instructors.filter((instructor) => instructor.salary_type === 'per_class').length;
  const focusInstructor = instructors.find((instructor) => instructor.status === 'active') ?? instructors[0] ?? null;

  return (
    <aside className="space-y-4" data-testid="instructors-work-queue">
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Desk</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">강사 운영 보드</h2>
          <p className="mt-1 text-xs text-muted-foreground">강사 등록, 출근, 급여, 수업 배정을 한곳에서 이어갑니다.</p>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-2">
            <QueueRow icon={Users} label="현재 목록" value={`${currentCount}명`} />
            <QueueRow icon={UserCheck} label="재직" value={`${activeCount}명`} />
            <QueueRow icon={UserX} label="휴직" value={`${leaveCount}명`} />
            <QueueRow icon={Banknote} label="시급제" value={`${hourlyCount}명`} />
            <QueueRow icon={CalendarDays} label="월급제" value={`${monthlyCount}명`} />
            <QueueRow icon={ClipboardCheck} label="수업당" value={`${perClassCount}명`} />
          </div>

          <Button className="w-full justify-start gap-2" type="button" onClick={onAddInstructor}>
            <Plus className="h-4 w-4" />
            강사 등록 시작
          </Button>
        </div>
      </section>

      {focusInstructor ? (
        <section className="rounded-md border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">바로 확인할 강사</p>
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-semibold text-foreground">{focusInstructor.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{focusInstructor.phone || '연락처 없음'}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground">연결 업무</p>
        <div className="mt-3 grid gap-2">
          <QuickLink href="/schedules" icon={CalendarDays} label="수업스케줄" />
          <QuickLink href="/salaries" icon={Banknote} label="급여 관리" />
          <QuickLink href="/m/instructor" icon={Smartphone} label="모바일 출근" />
        </div>
      </section>
    </aside>
  );
}

function QueueRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Users;
  label: string;
}) {
  return (
    <Link
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      href={href}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Link>
  );
}
