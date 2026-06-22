import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PerformanceErrorPanelProps {
  message: string;
  title?: string;
  onRetry?: () => void;
}

export function PerformanceErrorPanel({ message, onRetry, title = '불러오지 못했습니다' }: PerformanceErrorPanelProps) {
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
            <p className="break-keep text-sm">{message}</p>
          </div>
        </div>
        {onRetry && (
          <Button className="gap-2" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            다시 불러오기
          </Button>
        )}
      </div>
    </section>
  );
}
