import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Instructor } from '@/lib/types/instructor';
import { INSTRUCTOR_STATUS_LABELS } from '@/lib/types/instructor';

const STATUS_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  active: 'success',
  on_leave: 'warning',
  retired: 'secondary',
};

/** 강사 재직 상태 배지 */
export function InstructorStatusBadge({ status, className }: { status: Instructor['status']; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] || 'secondary'} className={className}>
      {INSTRUCTOR_STATUS_LABELS[status] || status}
    </Badge>
  );
}

/** 강사 이름 첫 글자 동그라미(성별에 따라 옅은 색만 다르게) */
export function InstructorInitial({ instructor, className }: { instructor: Pick<Instructor, 'name' | 'gender'>; className?: string }) {
  const tone = instructor.gender === 'male'
    ? 'bg-primary-soft text-primary'
    : instructor.gender === 'female'
      ? 'bg-destructive-soft text-destructive'
      : 'bg-muted text-secondary-foreground';
  return (
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold', tone, className)}>
      {instructor.name.charAt(0)}
    </span>
  );
}
