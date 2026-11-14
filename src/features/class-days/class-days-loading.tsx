import { ClassDaysHeader } from './class-days-header';

export function ClassDaysLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <ClassDaysHeader description="수업일 목록을 불러오고 있어요." />
      <section className="rounded-2xl bg-card p-5 sm:p-6" aria-busy="true">
        <div className="mb-5 h-11 w-full max-w-xl rounded-xl bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-xl bg-muted/60 p-4 md:grid-cols-[160px_1fr_220px]">
              <div className="h-5 rounded-lg bg-muted" />
              <div className="h-5 rounded-lg bg-muted" />
              <div className="h-5 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
