import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
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
    <article className="rounded-2xl bg-card p-4" data-testid="mobile-attendance-row">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] font-bold text-secondary-foreground">
          {student.student_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[17px] font-bold text-foreground">{student.student_name}</h2>
            {activeMeta && <Badge variant={activeMeta.badgeVariant} className="shrink-0">{activeMeta.label}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            {student.grade && student.grade !== '0' && student.grade !== '00' && <span>{student.grade}</span>}
            {!!student.is_season_student && <Badge variant="warning">시즌</Badge>}
            {!!student.is_makeup && <Badge variant="default">보충</Badge>}
            {student.assigned === false && <Badge variant="secondary">오늘 수업 아님</Badge>}
            {!!student.is_trial && <Badge variant="success">체험 {student.trial_remaining ?? 0}회</Badge>}
          </div>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => onCall(student.phone)} aria-label={`${student.student_name} 전화`} className="shrink-0 rounded-full">
          <Phone className="h-5 w-5" />
        </Button>
      </div>

      {note && (
        <p className="mt-3 rounded-xl bg-muted px-3 py-2.5 text-sm text-secondary-foreground">{note}</p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        {MARKABLE_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const active = attendanceStatus === status;
          return (
            <button
              type="button"
              key={status}
              disabled={saving}
              aria-pressed={active}
              onClick={() => onStatusChange(student, status)}
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
