import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExpensesErrorProps {
  message: string;
  onRetry: () => void;
}

export function ExpensesError({ message, onRetry }: ExpensesErrorProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <header className="border-b border-border/70 pb-4">
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">지출 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">운영비, 환불, 급여 연동 지출을 확인합니다.</p>
      </header>
      <section
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
        role="alert"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">지출 내역을 불러오지 못했습니다</h2>
              <p className="break-keep text-sm">{message}</p>
            </div>
          </div>
          <Button className="gap-2" type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </Button>
        </div>
      </section>
    </div>
  );
}
