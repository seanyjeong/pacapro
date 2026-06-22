import { Loader2 } from 'lucide-react';

export function TabletSettingsLoading() {
  return (
    <div className="space-y-3" aria-label="설정 로딩">
      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">설정 정보를 불러오는 중입니다</p>
            <p className="text-xs text-muted-foreground">계정과 알림 상태를 확인하고 있습니다.</p>
          </div>
        </div>
      </section>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-24 animate-pulse rounded-md border border-border bg-muted/40" />
      ))}
    </div>
  );
}
