import { Loader2 } from 'lucide-react';

export function TabletSettingsLoading() {
  return (
    <div className="space-y-3" aria-label="설정 로딩">
      <section className="flex items-center gap-3 rounded-2xl bg-card p-5">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-[15px] font-semibold text-foreground">설정 정보를 불러오는 중이에요</p>
          <p className="text-[13px] text-muted-foreground">계정과 알림 상태를 확인하고 있어요.</p>
        </div>
      </section>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-24 animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}
