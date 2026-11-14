import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
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
    <article className="py-4 first:pt-1 last:pb-1" data-testid="mobile-instructor-card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] font-bold text-secondary-foreground">
          {instructor.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[17px] font-bold text-foreground">{instructor.name}</h3>
            {activeMeta && <Badge variant={activeMeta.badgeVariant} className="shrink-0">{activeMeta.label}</Badge>}
            {cleared && <Badge variant="secondary" className="shrink-0">해제</Badge>}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {instructor.source === 'approved' ? '승인된 추가 출근' : '배정된 강사'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {MOBILE_INSTRUCTOR_STATUSES.map((status) => {
          const meta = MOBILE_INSTRUCTOR_STATUS_META[status];
          const active = attendanceStatus === status;
          return (
            <button
              type="button"
              key={status}
              disabled={saving}
              aria-pressed={active}
              onClick={() => onStatusChange(status)}
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
