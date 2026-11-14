import { Button } from '@/components/ui/button';
import type { PaginationState } from './enrolled-consultations-types';

interface EnrolledConsultationsPaginationProps {
  pagination: PaginationState;
  onChange: (pagination: PaginationState) => void;
}

export function EnrolledConsultationsPagination({ pagination, onChange }: EnrolledConsultationsPaginationProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-t border-border/60 px-5 py-4">
      <Button
        variant="outline"
        size="sm"
        disabled={pagination.page === 1}
        onClick={() => onChange({ ...pagination, page: pagination.page - 1 })}
      >
        이전
      </Button>
      <span className="px-3 text-sm font-semibold text-secondary-foreground tabular-nums">
        {pagination.page} / {pagination.totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagination.page === pagination.totalPages}
        onClick={() => onChange({ ...pagination, page: pagination.page + 1 })}
      >
        다음
      </Button>
    </div>
  );
}
