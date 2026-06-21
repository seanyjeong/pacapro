import { Button } from '@/components/ui/button';
import type { PaginationState } from './enrolled-consultations-types';

interface EnrolledConsultationsPaginationProps {
  pagination: PaginationState;
  onChange: (pagination: PaginationState) => void;
}

export function EnrolledConsultationsPagination({ pagination, onChange }: EnrolledConsultationsPaginationProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex justify-center gap-2">
      <Button
        variant="outline"
        disabled={pagination.page === 1}
        onClick={() => onChange({ ...pagination, page: pagination.page - 1 })}
      >
        이전
      </Button>
      <span className="flex items-center px-4">
        {pagination.page} / {pagination.totalPages}
      </span>
      <Button
        variant="outline"
        disabled={pagination.page === pagination.totalPages}
        onClick={() => onChange({ ...pagination, page: pagination.page + 1 })}
      >
        다음
      </Button>
    </div>
  );
}
