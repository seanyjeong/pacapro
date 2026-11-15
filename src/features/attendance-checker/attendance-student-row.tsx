import Link from 'next/link';
import { AlertCircle, Calendar, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Attendance, AttendanceStatus } from '@/lib/types/schedule';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/types/schedule';
import { formatDateToString } from '@/lib/utils/schedule-helpers';
import type { EditedAttendanceData } from './attendance-checker-types';
import { ATTENDANCE_STATUS_BUTTONS } from './attendance-status-meta';

interface AttendanceStudentRowProps {
  attendance: Attendance;
  edited?: EditedAttendanceData;
  currentDate?: string;
  readOnly: boolean;
  onStatusChange: (studentId: number, status: AttendanceStatus | null, studentName?: string) => void;
  onMakeupDateChange: (studentId: number, makeupDate: string) => void;
  onNotesChange: (studentId: number, notes: string) => void;
}

export function AttendanceStudentRow({
  attendance,
  edited,
  currentDate,
  readOnly,
  onStatusChange,
  onMakeupDateChange,
  onNotesChange,
}: AttendanceStudentRowProps) {
  const currentStatus = edited?.status || attendance.attendance_status;
  const currentMakeupDate = edited?.makeup_date || attendance.makeup_date || '';
  const currentNotes = edited?.notes || attendance.notes || '';
  const isFromMakeup = Boolean(attendance.is_makeup);
  // 다른 날짜에서 보충으로 넘어온 학생(원래 날짜가 있음)만 잠근다. 이 수업에 보충으로 추가한 학생은 바로 출석을 찍는다.
  const isFromOtherDate = isFromMakeup && Boolean(attendance.original_date);
  const statusLocked = readOnly || isFromOtherDate;

  return (
    <div className={cn('space-y-3 py-4', isFromMakeup && '-mx-3 rounded-xl bg-muted px-3')}>
      <div className="flex items-center gap-3">
        <Link
          aria-label={`${attendance.student_name} 학생 상세`}
          className="-m-1 flex min-w-0 flex-1 items-center gap-1 rounded-lg p-1 transition-colors hover:bg-muted"
          href={`/students/${attendance.student_id}`}
        >
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[17px] font-bold text-foreground">{attendance.student_name}</span>
              {isFromMakeup && <Badge variant="default" className="shrink-0">보충</Badge>}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">
              학번 {attendance.student_number}
              {isFromMakeup && attendance.original_date && <> · 원래 날짜 {attendance.original_date}</>}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        </Link>
      </div>

      <div
        className="grid grid-cols-5 gap-1.5"
        role="group"
        aria-label={`${attendance.student_name} 출석 상태`}
      >
        {ATTENDANCE_STATUS_BUTTONS.map(({ status, active }) => {
          const selected = currentStatus === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              title={status === 'excused' ? '공결 (공식적 결석)' : undefined}
              disabled={statusLocked}
              onClick={() => onStatusChange(attendance.student_id, status, attendance.student_name)}
              className={cn(
                'h-12 rounded-xl text-[15px] font-bold transition-colors active:scale-[0.97] disabled:cursor-not-allowed',
                selected ? active : 'bg-muted text-secondary-foreground hover:bg-muted/70 hover:text-foreground',
                statusLocked && !selected && 'opacity-50',
                isFromMakeup && !selected && 'bg-card'
              )}
            >
              {ATTENDANCE_STATUS_LABELS[status]}
            </button>
          );
        })}
      </div>

      {currentStatus === 'makeup' && !isFromOtherDate && (
        <label className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-[13px] font-semibold text-secondary-foreground">보충 날짜</span>
          <Input
            type="date"
            value={currentMakeupDate}
            onChange={(event) => onMakeupDateChange(attendance.student_id, event.target.value)}
            min={currentDate || formatDateToString(new Date())}
            className="flex-1"
            disabled={readOnly}
            aria-label={`${attendance.student_name} 보충 날짜`}
          />
        </label>
      )}

      {(currentStatus === 'absent' || currentStatus === 'excused') && currentNotes && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
            currentStatus === 'excused'
              ? 'bg-primary-soft text-primary'
              : 'bg-destructive-soft text-destructive'
          )}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>사유: {currentNotes}</span>
        </div>
      )}
      {currentStatus !== 'absent' && currentStatus !== 'excused' && (
        <Textarea
          value={currentNotes}
          onChange={(event) => onNotesChange(attendance.student_id, event.target.value)}
          placeholder="메모 (선택)"
          rows={1}
          disabled={readOnly}
          className={cn('min-h-11 resize-none py-2.5', isFromMakeup && 'bg-card')}
          aria-label={`${attendance.student_name} 메모`}
        />
      )}
    </div>
  );
}
