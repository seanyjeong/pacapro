import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentDetailBack } from './student-detail-header';

interface StudentDetailStateProps {
  message?: string | null;
  onBack: () => void;
  onRetry?: () => void;
}

export function StudentDetailLoading({ onBack }: StudentDetailStateProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4" aria-busy="true" aria-label="학생 상세 정보를 불러오는 중">
      <StudentDetailBack onBack={onBack} />
      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-32 rounded-lg bg-muted" />
            <div className="h-4 w-full max-w-md rounded-lg bg-muted" />
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl bg-card p-5">
            <div className="h-3 w-16 rounded-lg bg-muted" />
            <div className="mt-3 h-6 w-28 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentDetailError({ message, onBack, onRetry }: StudentDetailStateProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <StudentDetailBack onBack={onBack} />
      <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-[15px] font-bold">학생 정보를 불러올 수 없어요</h2>
              <p className="text-sm">
                {message || '학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
              </p>
            </div>
          </div>
          {onRetry ? (
            <Button className="w-full sm:w-auto" size="sm" type="button" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              다시 불러오기
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
