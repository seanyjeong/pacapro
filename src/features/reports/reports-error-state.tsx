import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportsErrorStateProps {
  message: string;
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  onRetry: () => void;
}

export function ReportsErrorState({ message, selectedMonth, onMonthChange, onRetry }: ReportsErrorStateProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">리포트</h1>
        </div>
        <input
          aria-label="조회 월"
          type="month"
          value={selectedMonth}
          onChange={(event) => onMonthChange(event.target.value)}
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 sm:w-auto"
        />
      </header>

      <section className="rounded-md border border-border bg-card p-6" role="alert">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">리포트를 표시할 수 없습니다</h2>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 시도
          </Button>
        </div>
      </section>
    </div>
  );
}
