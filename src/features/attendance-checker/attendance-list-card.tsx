import Link from 'next/link';
import { Save, Send, UserCheck, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ATTENDANCE_TEST_NOTIFICATION_HREF } from '@/lib/constants/notification-links';
import type { Attendance, AttendanceStatus } from '@/lib/types/schedule';
import type { EditedAttendanceData } from './attendance-checker-types';
import { AttendanceStudentRow } from './attendance-student-row';

interface AttendanceListCardProps {
  attendances: Attendance[];
  editedAttendances: Map<number, EditedAttendanceData>;
  isSubmitting?: boolean;
  readOnly: boolean;
  currentDate?: string;
  timeSlot?: string;
  hasChanges: boolean;
  onOpenAddStudent: () => void;
  onSubmit: () => void;
  onStatusChange: (studentId: number, status: AttendanceStatus | null, studentName?: string) => void;
  onMakeupDateChange: (studentId: number, makeupDate: string) => void;
  onNotesChange: (studentId: number, notes: string) => void;
}

export function AttendanceListCard({
  attendances,
  editedAttendances,
  isSubmitting,
  readOnly,
  currentDate,
  timeSlot,
  hasChanges,
  onOpenAddStudent,
  onSubmit,
  onStatusChange,
  onMakeupDateChange,
  onNotesChange,
}: AttendanceListCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>학생 출석 체크</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Link
              className={buttonVariants({ variant: 'outline', className: 'gap-2' })}
              href={ATTENDANCE_TEST_NOTIFICATION_HREF}
            >
              <Send className="h-4 w-4" />
              출결 테스트발송
            </Link>
            {!readOnly && currentDate && timeSlot && (
              <Button variant="outline" onClick={onOpenAddStudent}>
                <UserPlus className="h-4 w-4 mr-2" />
                보충 학생 추가
              </Button>
            )}
            {!readOnly && attendances.length > 0 && (
              <Button onClick={onSubmit} disabled={isSubmitting || !hasChanges}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {attendances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>이 수업에 등록된 학생이 없습니다.</p>
            <p className="text-sm mt-1">학생을 먼저 등록해주세요.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {attendances.map((attendance) => (
              <AttendanceStudentRow
                key={attendance.student_id}
                attendance={attendance}
                edited={editedAttendances.get(attendance.student_id)}
                currentDate={currentDate}
                readOnly={readOnly}
                onStatusChange={onStatusChange}
                onMakeupDateChange={onMakeupDateChange}
                onNotesChange={onNotesChange}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
