import type { StudentParentNames as ParentNames } from '@/lib/types/student-parent-names';
import { visibleParentName } from '@/lib/utils/student-parent-names';
import { cn } from '@/lib/utils/cn';

export function StudentParentNames({ student, className }: { student: ParentNames; className?: string }) {
  const father = visibleParentName(student.father_name);
  const mother = visibleParentName(student.mother_name);
  if (!father && !mother) return null;
  return (
    <div className={cn('mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground', className)}>
      {father && <span className="min-w-0 [overflow-wrap:anywhere]">아버지 {father}</span>}
      {mother && <span className="min-w-0 [overflow-wrap:anywhere]">어머니 {mother}</span>}
    </div>
  );
}
