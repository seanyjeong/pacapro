import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EnrolledConsultationsErrorProps {
  message: string;
  onRetry: () => void;
}

export function EnrolledConsultationsError({ message, onRetry }: EnrolledConsultationsErrorProps) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-none dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">재원생상담 목록을 불러오지 못했습니다</h2>
            <p className="text-sm">{message}</p>
          </div>
        </div>
        <Button type="button" onClick={onRetry} size="sm" variant="outline">
          다시 시도
        </Button>
      </div>
    </section>
  );
}
