import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { REPORT_MONTH_INPUT_CLASS } from './reports-header';

interface ReportsErrorStateProps {
  message: string;
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  onRetry: () => void;
}

export function ReportsErrorState({ message, selectedMonth, onMonthChange, onRetry }: ReportsErrorStateProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-4 md:max-w-7xl">
      <PageHeader
        title="리포트"
        actions={(
          <input
            aria-label="조회 월"
            type="month"
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
            className={`${REPORT_MONTH_INPUT_CLASS} w-full sm:w-44`}
          />
        )}
      />

      <section className="rounded-2xl bg-card p-5 sm:p-6" role="alert">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">리포트를 표시할 수 없습니다</h2>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
          <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </Button>
        </div>
      </section>
    </div>
  );
}
