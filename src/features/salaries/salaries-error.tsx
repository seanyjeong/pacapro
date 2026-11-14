import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface SalariesErrorProps {
  message: string;
  onRetry: () => void;
}

export function SalariesError({ message, onRetry }: SalariesErrorProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-4 md:max-w-7xl">
      <PageHeader title="급여 관리" description="강사 출근 기록으로 계산한 급여와 지급 상태를 확인해요." />
      <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-[15px] font-bold">급여 정보를 불러오지 못했습니다</h2>
              <p className="break-keep text-sm">{message}</p>
            </div>
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
