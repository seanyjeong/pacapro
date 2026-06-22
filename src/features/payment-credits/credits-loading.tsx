export function CreditsLoading() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <div className="border-b border-border/70 pb-4">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-72 rounded-md bg-muted/70" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-5">
            <div className="h-4 w-20 rounded-md bg-muted" />
            <div className="mt-4 h-8 w-28 rounded-md bg-muted/80" />
            <div className="mt-2 h-3 w-16 rounded-md bg-muted/60" />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-border bg-card p-5">
        <div className="h-10 w-full rounded-md bg-muted" />
        <div className="mt-3 h-10 w-full rounded-md bg-muted/70" />
        <div className="mt-3 h-10 w-full rounded-md bg-muted/50" />
      </div>
    </div>
  );
}
