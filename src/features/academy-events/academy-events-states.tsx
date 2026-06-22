import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AcademyEventsHeader } from './academy-events-header';

interface AcademyEventsErrorProps {
  message: string;
  onRetry: () => void;
}

export function AcademyEventsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 py-4 md:py-8">
      <AcademyEventsHeader canEditEvents={false} />
      <section className="rounded-md border border-border bg-card p-5" aria-busy="true">
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-md border border-border/70 p-4">
              <div className="h-3 w-16 rounded-md bg-muted" />
              <div className="mt-3 h-6 w-12 rounded-md bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-md border border-border/70 text-center">
          <div className="text-muted-foreground">
            <Loader2 className="mx-auto h-7 w-7 animate-spin" />
            <p className="mt-3 text-sm">학원 일정을 불러오는 중입니다.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AcademyEventsError({ message, onRetry }: AcademyEventsErrorProps) {
  return (
    <section
      className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">학원 일정을 불러오지 못했습니다</h2>
            <p className="text-sm">{message}</p>
          </div>
        </div>
        <Button className="gap-2" size="sm" type="button" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          다시 불러오기
        </Button>
      </div>
    </section>
  );
}
