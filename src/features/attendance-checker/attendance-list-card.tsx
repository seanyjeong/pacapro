import Link from 'next/link';
import type { ReactNode } from 'react';
import { Save, Send, UserCheck, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState, SectionCard } from '@/components/ui/page';
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
  /** 카드 맨 위 한 줄에 놓는 보기 선택(시간대 보기·반으로 보기). */
  filter?: ReactNode;
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
  filter,
  onOpenAddStudent,
  onSubmit,
  onStatusChange,
  onMakeupDateChange,
  onNotesChange,
}: AttendanceListCardProps) {
  const canSave = !readOnly && attendances.length > 0;

  return (
    <SectionCard
      title={`학생 ${attendances.length}명`}
      description={readOnly ? undefined : '같은 버튼을 한 번 더 누르면 미체크로 돌아가요.'}
      actions={
        <Link
          aria-label="출결 테스트발송"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1.5' })}
          href={ATTENDANCE_TEST_NOTIFICATION_HREF}
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">출결 테스트발송</span>
        </Link>
      }
    >
      {(filter || (!readOnly && currentDate && timeSlot)) && (
        <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:items-center">
          {filter}
          {!readOnly && currentDate && timeSlot && (
            <Button className="sm:ml-auto" variant="outline" onClick={onOpenAddStudent}>
              <UserPlus className="h-4 w-4" />
              보충 학생 추가
            </Button>
          )}
        </div>
      )}

      {attendances.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="이 수업에 등록된 학생이 없어요."
          description="학생을 먼저 등록해 주세요."
        />
      ) : (
        <div className="divide-y divide-border/60">
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

      {canSave && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+68px)] z-10 -mx-2 mt-2 rounded-2xl bg-card/95 p-2 backdrop-blur md:bottom-4">
          <Button className="w-full" size="lg" onClick={onSubmit} disabled={isSubmitting || !hasChanges}>
            <Save className="h-5 w-5" />
            {isSubmitting ? '저장 중...' : '저장'}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
