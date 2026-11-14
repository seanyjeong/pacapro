import { Suspense } from 'react';
import { ConsultationCalendarContent } from './consultation-calendar-content';

function CalendarPageFallback() {
  return (
    <div className="space-y-4">
      <div className="h-16 w-56 animate-pulse rounded-2xl bg-card" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
      <div className="h-[520px] animate-pulse rounded-2xl bg-card" />
    </div>
  );
}

export default function ConsultationCalendarPage() {
  return (
    <Suspense fallback={<CalendarPageFallback />}>
      <ConsultationCalendarContent />
    </Suspense>
  );
}
