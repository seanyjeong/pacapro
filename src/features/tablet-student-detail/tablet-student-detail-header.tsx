import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentAvatar } from '@/components/students/student-avatar';
import type { TabletStudentDetail } from './tablet-student-detail-types';
import { TABLET_STUDENT_STATUS_META } from './tablet-student-detail-utils';

interface TabletStudentDetailHeaderProps {
  actions: ReactNode;
  onBack: () => void;
  student: TabletStudentDetail;
}

export function TabletStudentDetailHeader({ actions, onBack, student }: TabletStudentDetailHeaderProps) {
  const status = TABLET_STUDENT_STATUS_META[student.status] || { variant: 'secondary' as const, label: student.status };

  return (
    <>
      <Button type="button" variant="ghost" onClick={onBack} className="-ml-2 text-secondary-foreground">
        <ArrowLeft className="h-5 w-5" />
        목록으로
      </Button>

      <section className="rounded-2xl bg-card p-5 sm:p-6" aria-label="학생 요약">
        <div className="flex items-center gap-4">
          <StudentAvatar
            size="lg"
            imageFit="contain"
            student={{ ...student, profile_image_url: student.profile_image_url ?? null }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground">{student.name}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
              {student.is_trial ? <Badge variant="default">체험 {student.trial_remaining}회 남음</Badge> : null}
            </div>
            <p className="mt-1 text-[15px] text-muted-foreground">{student.grade} · {student.school || '-'}</p>
          </div>
        </div>
        <div className="mt-5">{actions}</div>
      </section>
    </>
  );
}
