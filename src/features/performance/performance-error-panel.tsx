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
      className="rounded-2xl bg-warning-soft p-5 text-warning"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h2 className="text-[15px] font-bold">{title}</h2>
            <p className="break-keep text-sm">{message}</p>
          </div>
        </div>
        {onRetry && (
          <Button className="w-full gap-2 sm:w-auto" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            다시 불러오기
          </Button>
        )}
      </div>
    </section>
  );
}
