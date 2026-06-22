import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEASON_DETAIL_LOAD_ERROR } from './season-detail-utils';

interface SeasonDetailErrorProps {
  message: string | null;
  onBack: () => void;
  onRetry: () => void;
}

export function SeasonDetailError({ message, onBack, onRetry }: SeasonDetailErrorProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <Button type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        목록
      </Button>

      <section className="rounded-md border border-border bg-card p-6" role="alert">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">시즌을 표시할 수 없습니다</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message ?? SEASON_DETAIL_LOAD_ERROR}</p>
          </div>
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 시도
          </Button>
        </div>
      </section>
    </div>
  );
}
