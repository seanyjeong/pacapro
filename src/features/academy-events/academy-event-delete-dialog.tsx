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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-xl sm:rounded-2xl sm:pb-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-soft">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h3 className="text-[17px] font-bold text-foreground">일정 삭제</h3>
            <p className="text-sm text-muted-foreground">삭제한 일정은 되돌릴 수 없어요.</p>
          </div>
        </div>
        <div className="mb-4 rounded-xl bg-muted p-3">
          <p className="text-[15px] font-semibold text-foreground">{event.title}</p>
          <p className="text-[13px] text-muted-foreground">{event.event_date}</p>
        </div>
        {event.is_holiday ? (
          <p className="mb-4 rounded-xl bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning">
            휴일 일정을 삭제하면 상담 차단과 수업 휴강이 해제됩니다.
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" className="w-full sm:w-auto" onClick={onConfirm}>
            삭제
          </Button>
        </div>
      </div>
    </div>
  );
}
