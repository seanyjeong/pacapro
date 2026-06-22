export function PaymentEditorLoading() {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-6">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
      </div>
    </section>
  );
}
