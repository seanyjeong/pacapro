import { ClassDaysHeader } from './class-days-header';

export function ClassDaysLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <ClassDaysHeader description="수업일 목록을 불러오는 중입니다." />
      <section className="rounded-md border border-border bg-card p-5" aria-busy="true">
        <div className="mb-5 h-10 w-full max-w-xl rounded-md bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-border/70 p-4 md:grid-cols-[160px_1fr_220px]">
              <div className="h-5 rounded-md bg-muted" />
              <div className="h-5 rounded-md bg-muted" />
              <div className="h-5 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
