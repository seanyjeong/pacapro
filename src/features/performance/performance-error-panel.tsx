import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PerformanceErrorPanelProps {
  message: string;
  onRetry?: () => void;
}

export function PerformanceErrorPanel({ message, onRetry }: PerformanceErrorPanelProps) {
  return (
    <section className="rounded-md border border-rose-200 bg-rose-50 px-5 py-6 dark:border-rose-900/70 dark:bg-rose-950/30">
      <p className="break-keep text-sm font-medium text-rose-900 dark:text-rose-100">{message}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          다시 불러오기
        </Button>
      )}
    </section>
  );
}
