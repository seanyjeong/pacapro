import Link from 'next/link';
import { AlertCircle, Check, Clock, Loader2, Sparkles, User, UserRound, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/lib/types/schedule';
import { OTHER_SLOTS, STUDENT_ATTENDANCE_STATUS, TIME_SLOT_INFO } from './time-slot-detail-constants';
import { getTrialBadgeInfo } from './time-slot-detail-utils';
import { AttendanceReasonPanel } from './attendance-reason-panel';
import type {
  AttendanceStudent,
  ReasonInputState,
  StudentAttendanceState,
} from './time-slot-detail-types';

interface StudentAttendanceCardProps {
  date: string;
  timeSlot: TimeSlot;
  student: AttendanceStudent;
  currentData?: StudentAttendanceState;
  isSaving: boolean;
  isMoving: boolean;
  reasonInput: ReasonInputState | null;
  onAttendance: (studentId: number, status: string) => void;
  onMove: (studentId: number, toSlot: TimeSlot) => void;
  onReasonChange: (reasonInput: ReasonInputState) => void;
  onReasonConfirm: () => void;
  onReasonCancel: () => void;
}

export function StudentAttendanceCard({
  date,
  timeSlot,
  student,
  currentData,
  isSaving,
  isMoving,
  reasonInput,
  onAttendance,
  onMove,
  onReasonChange,
  onReasonConfirm,
  onReasonCancel,
}: StudentAttendanceCardProps) {
  const currentStatus = currentData?.status || '';
  const currentNotes = currentData?.notes || '';
  const trialBadge = getTrialBadgeInfo(date, student, currentStatus);
  const isReasonInputOpen = reasonInput?.studentId === student.student_id;

  return (
    <div className="group space-y-3 rounded-xl bg-muted p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-[16px] font-bold text-foreground">{student.student_name}</span>
            {student.grade && (
              <span className="text-xs text-muted-foreground">{student.grade}</span>
            )}
            {trialBadge && (
              <Badge variant={trialBadge.completed ? 'secondary' : 'default'}>
                <Sparkles className="h-3 w-3" />
                {trialBadge.text}
              </Badge>
            )}
            {student.season_type && (
              <Badge variant="success">
                시즌
              </Badge>
            )}
            {!!student.is_makeup && (
              <Badge variant="warning">
                보충
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-8 gap-1 bg-card px-2.5 text-[13px]'
            )}
            href={`/students/${student.student_id}`}
          >
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">학생 상세</span>
          </Link>
          {OTHER_SLOTS[timeSlot].map((otherSlot) => {
            const otherInfo = TIME_SLOT_INFO[otherSlot];
            const OtherIcon = otherInfo.icon;
            return (
              <Button
                key={otherSlot}
                size="sm"
                variant="outline"
                className={cn('h-8 gap-1 bg-card px-2.5 text-[13px]', otherInfo.color)}
                disabled={isMoving}
                onClick={() => onMove(student.student_id, otherSlot)}
                title={`${otherInfo.label}으로 이동`}
              >
                <OtherIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="shrink-0">{otherInfo.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-1.5">
        {STUDENT_ATTENDANCE_STATUS.map((status) => {
          const isSelected = currentStatus === status.value;
          const StatusIcon = STUDENT_STATUS_ICONS[status.value];

          return (
            <button
              key={status.value}
              type="button"
              onClick={() => onAttendance(student.student_id, status.value)}
              disabled={isSaving}
              className={cn(
                'flex h-12 items-center justify-center gap-1 rounded-xl text-[15px] font-bold transition-colors active:scale-[0.97]',
                isSelected
                  ? status.color
                  : 'bg-card text-secondary-foreground hover:text-foreground'
              )}
            >
              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0">{status.label}</span>
            </button>
          );
        })}
      </div>
      {isSaving && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          저장 중
        </p>
      )}

      {(currentStatus === 'absent' || currentStatus === 'excused') && currentNotes && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium',
            currentStatus === 'excused'
              ? 'bg-primary-soft text-primary'
              : 'bg-destructive-soft text-destructive'
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>사유: {currentNotes}</span>
        </div>
      )}

      {isReasonInputOpen && reasonInput && (
        <AttendanceReasonPanel
          reasonInput={reasonInput}
          onChange={onReasonChange}
          onCancel={onReasonCancel}
          onConfirm={onReasonConfirm}
        />
      )}
    </div>
  );
}

const STUDENT_STATUS_ICONS = {
  present: Check,
  absent: X,
  late: Clock,
  excused: AlertCircle,
};
