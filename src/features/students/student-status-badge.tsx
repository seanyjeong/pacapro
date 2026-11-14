import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { StudentStatus } from '@/lib/types/student';
import { STATUS_LABELS } from '@/lib/types/student';

const STATUS_VARIANT: Record<StudentStatus, NonNullable<BadgeProps['variant']>> = {
    active: 'success',
    paused: 'warning',
    graduated: 'default',
    withdrawn: 'secondary',
    trial: 'default',
    pending: 'warning',
    prospect: 'secondary',
};

/** 학생 상태 배지(옅은 색 알약). 학생 목록·상세에서 같은 색으로 쓴다. */
export function StudentStatusBadge({ status, className }: { status: StudentStatus; className?: string }) {
    return (
        <Badge variant={STATUS_VARIANT[status] || 'secondary'} className={className}>
            {STATUS_LABELS[status] || status}
        </Badge>
    );
}

/** 흰 카드 안에서 쓰는 기본 선택칸(회색 채움, 테두리 없음). Input 과 같은 모양. */
export const nativeSelectClass =
    'h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10';
