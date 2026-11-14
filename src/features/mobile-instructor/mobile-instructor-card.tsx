import { UserRound } from 'lucide-react';
import { MOBILE_INSTRUCTOR_STATUSES, MOBILE_INSTRUCTOR_STATUS_META } from './mobile-instructor-constants';
import type { MobileInstructor, MobileInstructorAttendanceStatus } from './mobile-instructor-types';

interface MobileInstructorCardProps {
  attendanceStatus: MobileInstructorAttendanceStatus | undefined;
  cleared: boolean;
  instructor: MobileInstructor;
  saving: boolean;
  onStatusChange: (status: MobileInstructorAttendanceStatus) => void;
}

export function MobileInstructorCard({
  attendanceStatus,
  cleared,
  instructor,
  saving,
  onStatusChange,
}: MobileInstructorCardProps) {
  const activeMeta = attendanceStatus ? MOBILE_INSTRUCTOR_STATUS_META[attendanceStatus] : null;

  return (
    <article
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      data-testid="mobile-instructor-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-secondary-foreground">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{instructor.name}</h3>
            {activeMeta && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${activeMeta.badgeClassName}`}>{activeMeta.label}</span>}
            {cleared && <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">해제</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {instructor.source === 'approved' ? '승인된 추가 출근' : '배정된 강사'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {MOBILE_INSTRUCTOR_STATUSES.map((status) => {
          const meta = MOBILE_INSTRUCTOR_STATUS_META[status];
          const active = attendanceStatus === status;
          return (
            <button
              type="button"
              key={status}
              disabled={saving}
              onClick={() => onStatusChange(status)}
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
