import { Badge } from '@/components/ui/badge';
import type { StudentWithCredit } from '@/lib/types/payment';
import { formatWon, getStudentStatusLabel } from './credits-utils';

interface CreditsStudentsSectionProps {
  students: StudentWithCredit[];
}

export function CreditsStudentsSection({ students }: CreditsStudentsSectionProps) {
  if (students.length === 0) return null;

  return (
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-none" aria-label="크레딧 보유 학생">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">크레딧 보유 학생</h2>
        <span className="text-xs text-muted-foreground">{students.length}명</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {students.map((student) => (
          <Badge key={student.id} variant="outline" className="gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-normal">
            <span className="font-medium text-foreground">{student.name}</span>
            {student.student_status !== 'active' ? (
              <span className="text-xs text-muted-foreground">{getStudentStatusLabel(student.student_status)}</span>
            ) : null}
            <span className="text-muted-foreground">{formatWon(student.total_remaining)}</span>
            <span className="text-xs text-muted-foreground">({student.credit_count}건)</span>
          </Badge>
        ))}
      </div>
    </section>
  );
}
