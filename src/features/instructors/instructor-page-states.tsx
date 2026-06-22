import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstructorLoadingPanelProps {
  message: string;
}

interface InstructorErrorPanelProps {
  message?: string | null;
  onRetry?: () => void;
  title: string;
}

export function InstructorLoadingPanel({ message }: InstructorLoadingPanelProps) {
  return (
    <section className="rounded-md border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border/70 p-4">
            <div className="h-3 w-16 rounded-md bg-muted" />
            <div className="mt-3 h-5 w-28 rounded-md bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex min-h-[180px] items-center justify-center rounded-md border border-border/70 text-center">
        <div className="text-muted-foreground">
          <Loader2 className="mx-auto h-7 w-7 animate-spin" />
          <p className="mt-3 text-sm">{message}</p>
        </div>
      </div>
    </section>
  );
}

export function InstructorErrorPanel({ message, onRetry, title }: InstructorErrorPanelProps) {
  return (
    <section
      className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-sm">{message || '잠시 후 다시 시도해 주세요.'}</p>
          </div>
        </div>
        {onRetry ? (
          <Button className="gap-2" size="sm" type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            다시 불러오기
          </Button>
        ) : null}
      </div>
    </section>
  );
}
