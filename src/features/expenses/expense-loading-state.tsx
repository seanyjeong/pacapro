export function ExpenseLoadingState() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4" aria-busy="true">
      <div className="space-y-2 pb-1 pt-2">
        <div className="h-8 w-32 rounded-xl bg-card" />
        <div className="h-4 w-56 rounded-lg bg-card" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-2xl bg-card p-5">
            <div className="h-4 w-20 rounded-lg bg-muted" />
            <div className="h-7 w-28 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-2xl bg-card p-5 sm:p-6">
        <div className="h-11 w-full rounded-xl bg-muted" />
        <div className="h-12 w-full rounded-xl bg-muted/70" />
        <div className="h-12 w-full rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}
