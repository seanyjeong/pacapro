import Link from 'next/link';
import { AlertCircle, Calendar, CheckCircle, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Attendance, AttendanceStatus } from '@/lib/types/schedule';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/types/schedule';
import {
  formatDateToString,
  getAttendanceStatusColor,
  getAttendanceStatusLabel,
} from '@/lib/utils/schedule-helpers';
import type { EditedAttendanceData } from './attendance-checker-types';

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

  return (
    <div
      className={cn(
        'p-4 border rounded-lg space-y-3',
        isFromMakeup && 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">
            {isFromMakeup && (
              <Badge variant="outline" className="mr-2 bg-purple-100 text-purple-700 border-purple-300">
                보충
              </Badge>
            )}
            {attendance.student_name}
          </p>
          <p className="text-sm text-muted-foreground">
            학번: {attendance.student_number}
            {isFromMakeup && attendance.original_date && (
              <span className="ml-2 text-purple-600">
                원래 날짜: {attendance.original_date}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            aria-label={`${attendance.student_name} 학생 상세`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1.5 px-2')}
            href={`/students/${attendance.student_id}`}
          >
            <UserRound className="h-3.5 w-3.5" />
            학생 상세
          </Link>
          {currentStatus && (
            <Badge variant="outline" className={cn(getAttendanceStatusColor(currentStatus))}>
              <CheckCircle className="h-3 w-3 mr-1" />
              {getAttendanceStatusLabel(currentStatus)}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Select
            value={currentStatus || 'none'}
            onValueChange={(value) =>
              onStatusChange(
                attendance.student_id,
                value === 'none' ? null : (value as AttendanceStatus),
                attendance.student_name
              )
            }
            disabled={readOnly || isFromMakeup}
          >
            <SelectTrigger>
              <SelectValue placeholder="출석 상태를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">미체크</SelectItem>
              <SelectItem value="present">{ATTENDANCE_STATUS_LABELS.present}</SelectItem>
              <SelectItem value="absent">{ATTENDANCE_STATUS_LABELS.absent}</SelectItem>
              <SelectItem value="late">{ATTENDANCE_STATUS_LABELS.late}</SelectItem>
              <SelectItem value="excused">
                <span className="flex items-center gap-1">
                  {ATTENDANCE_STATUS_LABELS.excused}
                  <span className="text-xs text-muted-foreground">(공식적 결석)</span>
                </span>
              </SelectItem>
              <SelectItem value="makeup">{ATTENDANCE_STATUS_LABELS.makeup}</SelectItem>
            </SelectContent>
          </Select>

          {currentStatus === 'makeup' && !isFromMakeup && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <Input
                type="date"
                value={currentMakeupDate}
                onChange={(event) => onMakeupDateChange(attendance.student_id, event.target.value)}
                min={currentDate || formatDateToString(new Date())}
                className="flex-1 text-sm"
                disabled={readOnly}
                aria-label={`${attendance.student_name} 보충 날짜`}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          {(currentStatus === 'absent' || currentStatus === 'excused') && currentNotes && (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                currentStatus === 'excused'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
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
              placeholder="메모 (선택사항)"
              rows={1}
              disabled={readOnly}
            />
          )}
        </div>
      </div>
    </div>
  );
}
