export function TabletPaymentsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="rounded-md border border-border bg-background px-4 py-4">
        <div className="h-4 w-32 rounded-md bg-muted" />
        <div className="mt-3 h-8 w-56 rounded-md bg-muted/80" />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="h-20 rounded-md bg-muted" />
        <div className="h-20 rounded-md bg-muted/80" />
        <div className="h-20 rounded-md bg-muted/70" />
        <div className="h-20 rounded-md bg-muted/60" />
      </div>
      <div className="h-28 rounded-md border border-border bg-background" />
      <div className="h-64 rounded-md border border-border bg-background" />
    </div>
  );
}
