import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SalaryDetailTitleBar } from './salary-detail-header';

interface SalaryDetailErrorProps {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}

export function SalaryDetailError({ message, onBack, onRetry }: SalaryDetailErrorProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SalaryDetailTitleBar onBack={onBack} />
      <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-[15px] font-bold">급여 정보를 불러오지 못했습니다</h2>
              <p className="break-keep text-sm">{message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="outline" onClick={onBack}>뒤로 가기</Button>
            <Button type="button" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
