import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentPageErrorProps {
  viewOnly: boolean;
  message: string;
  onRetry: () => void;
}

export function PaymentPageError({ viewOnly, message, onRetry }: PaymentPageErrorProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="border-b border-border/70 pb-4">
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
          {viewOnly ? '미납 학원비' : '학원비 관리'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {viewOnly ? '미납 학원비 현황 조회' : '청구, 수납, 크레딧, 미납 알림'}
        </p>
      </div>
      <section
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
        role="alert"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">학원비 정보를 불러오지 못했습니다</h3>
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
