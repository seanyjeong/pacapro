import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEASON_ENROLL_LOAD_ERROR } from './season-enroll-utils';

interface SeasonEnrollErrorProps {
  message: string | null;
  onBack: () => void;
  onRetry: () => void;
}

export function SeasonEnrollError({ message, onBack, onRetry }: SeasonEnrollErrorProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        시즌 목록
      </Button>
      <section className="rounded-md border border-rose-200 bg-rose-50 px-5 py-6">
        <p className="text-sm font-medium text-rose-900">{message ?? SEASON_ENROLL_LOAD_ERROR}</p>
        <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          다시 불러오기
        </Button>
      </section>
    </div>
  );
}
