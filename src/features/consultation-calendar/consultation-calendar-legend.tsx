import { FileText, UserCheck } from 'lucide-react';

export function ConsultationCalendarLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-secondary-foreground">
      <div className="flex items-center gap-3">
        <span className="font-medium text-muted-foreground">신규상담:</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-warning" />대기</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-primary" />확정</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 font-medium text-success">
          <UserCheck className="h-3 w-3" />
          재원생:
        </span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-success/20" />대기</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-success" />확정</span>
      </div>
      <span className="flex items-center gap-1 font-medium text-warning">
        <FileText className="h-3 w-3" />
        상담메모
      </span>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-success" />완료</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-muted-foreground/40" />취소</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-destructive" />노쇼</span>
      </div>
    </div>
  );
}
