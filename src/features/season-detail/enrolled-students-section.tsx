import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Season, StudentSeason, TimeSlot } from '@/lib/types/season';
import { EnrolledStudentCard } from './enrolled-student-card';
import { EnrolledStudentRow } from './enrolled-student-row';

interface EnrolledStudentsSectionProps {
  season: Season;
  enrolledStudents: StudentSeason[];
  cancellingId: number | null;
  updatingTimeSlotId: number | null;
  onAddStudent: () => void;
  onCancelEnrollment: (enrollmentId: number) => void;
  onOpenRefund: (enrollment: StudentSeason) => void;
  onTimeSlotChange: (enrollment: StudentSeason, slot: TimeSlot) => void;
}

export function EnrolledStudentsSection({
  season,
  enrolledStudents,
  cancellingId,
  updatingTimeSlotId,
  onAddStudent,
  onCancelEnrollment,
  onOpenRefund,
  onTimeSlotChange,
}: EnrolledStudentsSectionProps) {
  return (
    <section
      aria-labelledby="enrolled-students-title"
      className="w-full min-w-0 overflow-hidden rounded-md border border-border bg-card"
      data-testid="enrolled-students-section"
    >
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="enrolled-students-title" className="text-lg font-semibold text-foreground">
          등록 학생 ({enrolledStudents.length}명)
        </h2>
        <Button className="w-full sm:w-auto" size="sm" type="button" onClick={onAddStudent}>
          학생 등록
        </Button>
      </div>

      {enrolledStudents.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm">등록된 학생이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="hidden w-full overflow-x-auto md:block">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2 text-sm font-medium text-muted-foreground">학생명</th>
                  <th className="px-4 py-2 text-sm font-medium text-muted-foreground">시즌비</th>
                  <th className="px-4 py-2 text-sm font-medium text-muted-foreground">등록일</th>
                  <th className="px-4 py-2 text-sm font-medium text-muted-foreground">납부상태</th>
                  <th className="px-4 py-2 text-sm font-medium text-muted-foreground">시간대</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">관리</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map((enrollment) => (
                  <EnrolledStudentRow
                    key={enrollment.id}
                    cancelling={cancellingId === enrollment.id}
                    enrollment={enrollment}
                    season={season}
                    updatingTimeSlot={updatingTimeSlotId === enrollment.id}
                    onCancel={() => onCancelEnrollment(enrollment.id)}
                    onOpenRefund={() => onOpenRefund(enrollment)}
                    onTimeSlotChange={(slot) => onTimeSlotChange(enrollment, slot)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">
            {enrolledStudents.map((enrollment) => (
              <EnrolledStudentCard
                key={enrollment.id}
                cancelling={cancellingId === enrollment.id}
                enrollment={enrollment}
                season={season}
                updatingTimeSlot={updatingTimeSlotId === enrollment.id}
                onCancel={() => onCancelEnrollment(enrollment.id)}
                onOpenRefund={() => onOpenRefund(enrollment)}
                onTimeSlotChange={(slot) => onTimeSlotChange(enrollment, slot)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
