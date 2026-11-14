import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { StudentAvatar } from '@/components/students/student-avatar';
import { StudentStatusBadge } from '@/features/students/student-status-badge';
import type { StudentDetail } from '@/lib/types/student';
import { ADMISSION_TYPE_LABELS, GENDER_LABELS, STUDENT_TYPE_LABELS } from '@/lib/types/student';
import { formatStudentNumber, getStudentDisplayInfo } from '@/lib/utils/student-helpers';

interface StudentDetailHeroProps {
  student: StudentDetail;
  photoVersion?: string | null;
  actions: ReactNode;
}

// 학생 상세 맨 위 요약: 사진 · 이름(크게) · 상태/구분 배지 · 주요 동작.
export function StudentDetailHero({ student, photoVersion, actions }: StudentDetailHeroProps) {
  const studentNumber = formatStudentNumber(student.student_number);

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6" aria-label="학생 요약">
      <div className="flex items-start gap-4">
        <StudentAvatar cacheKey={photoVersion} imageFit="contain" size="lg" student={student} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-keep text-[26px] font-extrabold leading-tight tracking-tight text-foreground md:text-[28px]">{student.name}</h1>
            <StudentStatusBadge status={student.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{STUDENT_TYPE_LABELS[student.student_type]}</Badge>
            <Badge variant="secondary">{getStudentDisplayInfo(student)}</Badge>
            {student.gender ? <Badge variant="secondary">{GENDER_LABELS[student.gender]}</Badge> : null}
            <Badge>{ADMISSION_TYPE_LABELS[student.admission_type]}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {[student.school, studentNumber ? `학번 ${studentNumber}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="mt-5">{actions}</div>
    </section>
  );
}
