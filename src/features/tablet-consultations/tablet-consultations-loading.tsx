import { Loader2 } from 'lucide-react';

export function TabletConsultationsLoading() {
  return (
    <div className="space-y-4" aria-label="상담 일정 로딩">
      <section className="flex items-center gap-3 rounded-2xl bg-card p-5">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-[15px] font-semibold text-foreground">상담 일정을 불러오는 중이에요</p>
          <p className="text-[13px] text-muted-foreground">오늘 상담과 연결된 학생 정보를 확인하고 있어요.</p>
        </div>
      </section>
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-28 animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}
