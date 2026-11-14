import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClassDaysHeader } from './class-days-header';

interface ClassDaysErrorProps {
  onRetry: () => void;
}

export function ClassDaysError({ onRetry }: ClassDaysErrorProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <ClassDaysHeader description="수업일 목록을 다시 불러올 수 있어요." />
      <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-[15px] font-bold">수업일 목록을 불러오지 못했어요</h2>
              <p className="text-sm">잠시 후 다시 시도해주세요.</p>
            </div>
          </div>
          <Button className="w-full sm:w-auto" size="sm" type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            다시 불러오기
          </Button>
        </div>
      </section>
    </div>
  );
}
