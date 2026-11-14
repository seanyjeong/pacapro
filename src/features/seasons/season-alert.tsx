import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonAlertProps {
  message: string;
  title: string;
  actionLabel?: string;
  className?: string;
  testId?: string;
  onAction?: () => void;
}

export function SeasonAlert({ actionLabel, className = '', message, onAction, testId, title }: SeasonAlertProps) {
  return (
    <section
      className={`rounded-2xl bg-warning-soft p-5 text-warning ${className}`}
      data-testid={testId}
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
        {onAction && actionLabel ? (
          <Button className="w-full gap-2 sm:w-auto" size="sm" type="button" variant="outline" onClick={onAction}>
            <RefreshCw className="h-4 w-4" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
