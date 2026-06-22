import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentDetailStateProps {
  message?: string | null;
  onBack: () => void;
  onRetry?: () => void;
}

export function StudentDetailLoading({ onBack }: StudentDetailStateProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <Button size="sm" type="button" variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        목록으로
      </Button>
      <section className="rounded-md border border-border bg-card p-8">
        <div className="flex min-h-[260px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            학생 정보를 불러오는 중입니다
          </div>
        </div>
      </section>
    </div>
  );
}

export function StudentDetailError({ message, onBack, onRetry }: StudentDetailStateProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <Button size="sm" type="button" variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        목록으로
      </Button>
      <section className="rounded-md border border-border bg-card p-8" role="alert">
        <div className="flex min-h-[260px] items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-rose-50 text-rose-700">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">학생 정보를 불러올 수 없습니다</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {message || '학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
            </p>
            {onRetry ? (
              <Button className="mt-5" type="button" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                다시 시도
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
