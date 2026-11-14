import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
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
      className="w-full min-w-0 overflow-hidden rounded-2xl bg-card"
      data-testid="enrolled-students-section"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
        <h2 id="enrolled-students-title" className="text-[17px] font-bold tracking-tight text-foreground">
          등록 학생
        </h2>
        <Button size="sm" type="button" variant="secondary" onClick={onAddStudent}>
          학생 등록
        </Button>
      </div>

      {enrolledStudents.length === 0 ? (
        <EmptyState icon={Users} title="등록된 학생이 없어요." />
      ) : (
        <>
          <div className="hidden w-full overflow-x-auto px-2 pb-2 md:block">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="px-3 py-3.5 text-[13px] font-semibold text-muted-foreground">학생명</th>
                  <th className="px-3 py-3.5 text-[13px] font-semibold text-muted-foreground">시즌비</th>
                  <th className="px-3 py-3.5 text-[13px] font-semibold text-muted-foreground">등록일</th>
                  <th className="px-3 py-3.5 text-[13px] font-semibold text-muted-foreground">납부상태</th>
                  <th className="px-3 py-3.5 text-[13px] font-semibold text-muted-foreground">시간대</th>
                  <th className="px-3 py-3.5 text-right text-[13px] font-semibold text-muted-foreground">관리</th>
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
          <div className="divide-y divide-border/60 md:hidden">
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
