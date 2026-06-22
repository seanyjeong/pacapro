import { Loader2 } from 'lucide-react';

export function TabletConsultationsLoading() {
  return (
    <div className="space-y-4" aria-label="상담 일정 로딩">
      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">상담 일정을 불러오는 중입니다</p>
            <p className="text-xs text-muted-foreground">오늘 상담과 연결된 학생 정보를 확인하고 있습니다.</p>
          </div>
        </div>
      </section>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-28 animate-pulse rounded-md border border-border bg-muted/40" />
      ))}
    </div>
  );
}
