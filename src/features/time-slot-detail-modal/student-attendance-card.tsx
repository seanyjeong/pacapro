import { AlertCircle, Check, Clock, Loader2, Sparkles, User, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    <div className="group p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-medium text-foreground">{student.student_name}</span>
            {student.grade && (
              <span className="text-xs text-muted-foreground">{student.grade}</span>
            )}
            {trialBadge && (
              <Badge
                className={cn(
                  'text-xs flex items-center gap-1',
                  trialBadge.completed
                    ? 'bg-muted text-muted-foreground border-border'
                    : 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800'
                )}
              >
                <Sparkles className="h-3 w-3" />
                {trialBadge.text}
              </Badge>
            )}
            {student.season_type && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                시즌
              </Badge>
            )}
            {!!student.is_makeup && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                보충
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {OTHER_SLOTS[timeSlot].map((otherSlot) => {
            const otherInfo = TIME_SLOT_INFO[otherSlot];
            const OtherIcon = otherInfo.icon;
            return (
              <Button
                key={otherSlot}
                size="sm"
                variant="outline"
                className={cn('h-7 px-2 gap-1 text-xs font-medium', otherInfo.color, 'border hover:shadow-sm')}
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

      <div className="flex items-center gap-1.5 pl-0 sm:pl-11 flex-wrap">
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
                'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border shadow-sm active:scale-95',
                isSelected
                  ? `${status.color} text-white border-transparent shadow-md`
                  : 'bg-background text-foreground border-border hover:border-primary/50 hover:shadow'
              )}
            >
              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0">{status.label}</span>
            </button>
          );
        })}
        {isSaving && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />
        )}
      </div>

      {(currentStatus === 'absent' || currentStatus === 'excused') && currentNotes && (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 ml-0 sm:ml-11 rounded-md text-xs',
            currentStatus === 'excused'
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
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
