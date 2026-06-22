import { Suspense } from 'react';
import { ConsultationCalendarContent } from './consultation-calendar-content';

function CalendarPageFallback() {
  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="rounded-md border border-border bg-card p-5">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ConsultationCalendarPage() {
  return (
    <Suspense fallback={<CalendarPageFallback />}>
      <ConsultationCalendarContent />
    </Suspense>
  );
}
