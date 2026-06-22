import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TabletStudentDetail } from './tablet-student-detail-types';
import { TABLET_STUDENT_STATUS_META } from './tablet-student-detail-utils';

interface TabletStudentDetailHeaderProps {
  onBack: () => void;
  student: TabletStudentDetail;
}

export function TabletStudentDetailHeader({ onBack, student }: TabletStudentDetailHeaderProps) {
  const status = TABLET_STUDENT_STATUS_META[student.status] || {
    className: 'bg-muted text-foreground',
    label: student.status,
  };

  return (
    <section className="rounded-md border border-border bg-background p-4">
      <button type="button" onClick={onBack} className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="h-5 w-5" />
        <span>목록으로</span>
      </button>

      <div className="flex items-center gap-4">
        <div className={cn(
          'flex h-16 w-16 shrink-0 items-center justify-center rounded-md text-xl font-bold text-white',
          student.gender === 'male' ? 'bg-blue-600' : 'bg-pink-600'
        )}>
          {student.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{student.name}</h1>
            <span className={cn('rounded-full px-3 py-1 text-sm font-medium', status.className)}>{status.label}</span>
            {student.is_trial ? (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                체험 {student.trial_remaining}회 남음
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{student.grade} · {student.school || '-'}</p>
        </div>
      </div>
    </section>
  );
}
