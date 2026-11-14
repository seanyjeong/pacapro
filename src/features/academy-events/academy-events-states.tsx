import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AcademyEventsHeader } from './academy-events-header';

interface AcademyEventsErrorProps {
  message: string;
  onRetry: () => void;
}

export function AcademyEventsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <AcademyEventsHeader canEditEvents={false} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl bg-card p-5">
            <div className="h-3.5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-6 w-12 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-card text-center">
        <div className="text-muted-foreground">
          <Loader2 className="mx-auto h-7 w-7 animate-spin" />
          <p className="mt-3 text-sm">학원 일정을 불러오는 중이에요.</p>
        </div>
      </div>
    </div>
  );
}

export function AcademyEventsError({ message, onRetry }: AcademyEventsErrorProps) {
  return (
    <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h2 className="text-[15px] font-bold">학원 일정을 불러오지 못했어요</h2>
            <p className="text-sm">{message}</p>
          </div>
        </div>
        <Button className="w-full gap-2 sm:w-auto" size="sm" type="button" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          다시 불러오기
        </Button>
      </div>
    </section>
  );
}
