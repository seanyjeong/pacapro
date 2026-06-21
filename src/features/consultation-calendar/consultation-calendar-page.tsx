import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ConsultationCalendarContent } from './consultation-calendar-content';

export default function ConsultationCalendarPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}
    >
      <ConsultationCalendarContent />
    </Suspense>
  );
}
