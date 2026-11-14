import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { AttendanceStatus } from '@/lib/types/schedule';
import { TABLET_MARKS, TABLET_STATUS_META } from './tablet-attendance-constants';
import type { TabletAttendanceMark, TabletAttendanceStudent } from './tablet-attendance-types';

interface TabletAttendanceCardProps {
  saving: boolean;
  student: TabletAttendanceStudent;
  onChange: (student: TabletAttendanceStudent, status: TabletAttendanceMark) => void;
}

export function TabletAttendanceCard({ saving, student, onChange }: TabletAttendanceCardProps) {
  const activeStatus = student.attendance_status as AttendanceStatus | null;
  const activeMeta = TABLET_MARKS.includes(activeStatus as TabletAttendanceMark)
    ? TABLET_STATUS_META[activeStatus as TabletAttendanceMark]
    : null;

  return (
    <article className="rounded-2xl bg-card p-4" data-testid="tablet-attendance-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-secondary-foreground">
          {student.student_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[15px] font-bold text-foreground">{student.student_name}</h2>
            {activeMeta && <Badge variant={activeMeta.badgeVariant} className="shrink-0 px-2">{activeMeta.label}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {student.grade && student.grade !== '0' && student.grade !== '00' && <span>{student.grade}</span>}
            {!!student.season_type && <Badge variant="warning" className="px-2">시즌</Badge>}
            {!!student.is_trial && <Badge variant="success" className="px-2">체험 {student.trial_remaining ?? 0}회</Badge>}
            {!!student.is_makeup && <Badge variant="default" className="px-2">보충</Badge>}
            {student.assigned === false && <Badge variant="secondary" className="px-2">오늘 수업 아님</Badge>}
          </div>
        </div>
      </div>

      {student.notes && (
        <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-secondary-foreground">{student.notes}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {TABLET_MARKS.map((status) => {
          const meta = TABLET_STATUS_META[status];
          const active = student.attendance_status === status;
          return (
            <button
              type="button"
              key={status}
              disabled={saving}
              aria-pressed={active}
              onClick={() => onChange(student, status)}
              className={cn(
                'h-11 rounded-xl text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-50',
                active ? meta.activeClassName : meta.buttonClassName
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </article>
  );
}
