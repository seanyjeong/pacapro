import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface PaymentPageErrorProps {
  viewOnly: boolean;
  message: string;
  onRetry: () => void;
}

export function PaymentPageError({ viewOnly, message, onRetry }: PaymentPageErrorProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <PageHeader
        title={viewOnly ? '미납 학원비' : '학원비 관리'}
        description={viewOnly ? '미납 학원비 현황 조회' : '청구, 수납, 크레딧, 미납 알림'}
      />
      <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-[15px] font-bold">학원비 정보를 불러오지 못했습니다</h3>
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
