'use client';

export default function NotificationsLoadingState() {
  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="rounded-md border border-border bg-card p-5">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-md border border-border bg-card p-5">
                <div className="h-5 w-44 animate-pulse rounded bg-muted" />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="h-12 animate-pulse rounded bg-muted" />
                  <div className="h-12 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
          <aside className="space-y-5 lg:col-span-4">
            <div className="h-48 rounded-md border border-border bg-card p-5">
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              <div className="mt-5 h-24 animate-pulse rounded bg-muted" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
