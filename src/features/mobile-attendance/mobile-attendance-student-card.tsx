import { Phone, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AttendanceStatus } from '@/lib/types/schedule';
import { MARKABLE_STATUSES, STATUS_META } from './mobile-attendance-constants';
import type { MarkableAttendanceStatus, MobileAttendanceStudent } from './mobile-attendance-types';

interface MobileAttendanceStudentCardProps {
  attendanceStatus: AttendanceStatus | undefined;
  note: string | undefined;
  saving: boolean;
  student: MobileAttendanceStudent;
  onCall: (phone?: string | null) => void;
  onStatusChange: (student: MobileAttendanceStudent, status: MarkableAttendanceStatus) => void;
}

export function MobileAttendanceStudentCard({
  attendanceStatus,
  note,
  saving,
  student,
  onCall,
  onStatusChange,
}: MobileAttendanceStudentCardProps) {
  const activeStatus = MARKABLE_STATUSES.find((status) => status === attendanceStatus);
  const activeMeta = activeStatus ? STATUS_META[activeStatus] : null;

  return (
    <article
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      data-testid="mobile-attendance-row"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-secondary-foreground">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">{student.student_name}</h2>
            {activeMeta && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${activeMeta.badgeClassName}`}>{activeMeta.label}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {student.grade && student.grade !== '0' && student.grade !== '00' && <span>{student.grade}</span>}
            {student.is_season_student && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-warning">시즌</span>}
            {student.is_makeup && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">보충</span>}
            {student.assigned === false && <span className="rounded-full bg-muted px-1.5 py-0.5 text-secondary-foreground">오늘 수업 아님</span>}
            {student.is_trial && <span className="rounded-full bg-pink-50 px-1.5 py-0.5 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300">체험 {student.trial_remaining ?? 0}회</span>}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onCall(student.phone)} aria-label={`${student.student_name} 전화`} className="shrink-0">
          <Phone className="h-4 w-4" />
        </Button>
      </div>

      {note && (
        <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-secondary-foreground">
          {note}
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {MARKABLE_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const active = attendanceStatus === status;
          return (
            <button
              type="button"
              key={status}
              disabled={saving}
              onClick={() => onStatusChange(student, status)}
              className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 ${active ? meta.activeClassName : meta.buttonClassName}`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </article>
  );
}
