export function CreditsLoading() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-4 md:max-w-7xl">
      <div className="pb-1 pt-2">
        <div className="h-8 w-40 rounded-xl bg-muted" />
        <div className="mt-2 h-4 w-72 rounded-lg bg-muted/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl bg-card p-5">
            <div className="h-4 w-20 rounded-lg bg-muted" />
            <div className="mt-4 h-8 w-28 rounded-lg bg-muted/80" />
            <div className="mt-2 h-3 w-16 rounded-lg bg-muted/60" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-card p-5">
        <div className="h-11 w-full rounded-xl bg-muted" />
        <div className="mt-3 h-12 w-full rounded-xl bg-muted/70" />
        <div className="mt-3 h-12 w-full rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}
