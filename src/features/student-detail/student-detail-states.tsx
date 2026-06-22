import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentDetailHeader } from './student-detail-header';

interface StudentDetailStateProps {
  message?: string | null;
  onBack: () => void;
  onRetry?: () => void;
}

export function StudentDetailLoading({ onBack }: StudentDetailStateProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <StudentDetailHeader description="학생 상세 정보를 불러오는 중입니다." onBack={onBack} />
      <section className="rounded-md border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-md border border-border/70 p-4">
              <div className="h-3 w-16 rounded-md bg-muted" />
              <div className="mt-3 h-5 w-28 rounded-md bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-md border border-border/70 p-5">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-md bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-32 rounded-md bg-muted" />
              <div className="h-4 w-full max-w-xl rounded-md bg-muted" />
              <div className="h-4 w-full max-w-md rounded-md bg-muted" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function StudentDetailError({ message, onBack, onRetry }: StudentDetailStateProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <StudentDetailHeader description="학생 상세 정보를 다시 불러올 수 있습니다." onBack={onBack} />
      <section
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
        role="alert"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">학생 정보를 불러올 수 없습니다</h2>
              <p className="text-sm">
                {message || '학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
              </p>
            </div>
          </div>
          {onRetry ? (
            <Button className="gap-2" size="sm" type="button" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              다시 불러오기
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
