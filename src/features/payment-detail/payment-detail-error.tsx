import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface PaymentDetailErrorProps {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}

export function PaymentDetailError({ message, onBack, onRetry }: PaymentDetailErrorProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기" className="-ml-2 mt-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader className="min-w-0 flex-1" title="학원비 상세" />
      </div>
      <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-[15px] font-bold">학원비 상세를 불러오지 못했습니다</h2>
              <p className="break-keep text-sm">{message}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1 sm:flex-none">
              뒤로 가기
            </Button>
            <Button type="button" variant="outline" onClick={onRetry} className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
