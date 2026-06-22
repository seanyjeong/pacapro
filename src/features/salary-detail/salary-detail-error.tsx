import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SalaryDetailErrorProps {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}

export function SalaryDetailError({ message, onBack, onRetry }: SalaryDetailErrorProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3 border-b border-border/70 pb-4">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">급여 명세서</h1>
      </div>
      <section
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-none dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
        role="alert"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">급여 정보를 불러오지 못했습니다</h2>
              <p className="break-keep text-sm">{message}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack}>뒤로 가기</Button>
            <Button className="gap-2" type="button" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
