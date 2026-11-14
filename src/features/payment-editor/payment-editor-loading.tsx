export function PaymentEditorLoading() {
  return (
    <section className="rounded-2xl bg-card p-6">
      <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
    </section>
  );
}
