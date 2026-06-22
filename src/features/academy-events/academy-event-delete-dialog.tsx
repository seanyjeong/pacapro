import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AcademyEvent } from '@/lib/types/academyEvent';

interface AcademyEventDeleteDialogProps {
  event: AcademyEvent;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AcademyEventDeleteDialog({ event, onCancel, onConfirm }: AcademyEventDeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-md border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">일정 삭제</h3>
            <p className="text-sm text-muted-foreground">삭제한 일정은 되돌릴 수 없습니다.</p>
          </div>
        </div>
        <p className="mb-1 text-sm font-medium text-foreground">{event.title}</p>
        <p className="mb-4 text-sm text-muted-foreground">{event.event_date}</p>
        {event.is_holiday ? (
          <p className="mb-4 text-xs text-amber-700 dark:text-amber-300">
            휴일 일정을 삭제하면 상담 차단과 수업 휴강이 해제됩니다.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            삭제
          </Button>
        </div>
      </div>
    </div>
  );
}
