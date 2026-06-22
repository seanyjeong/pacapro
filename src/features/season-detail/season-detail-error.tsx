import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SeasonAlert } from '@/features/seasons/season-alert';
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

      <SeasonAlert
        actionLabel="다시 시도"
        message={message ?? SEASON_DETAIL_LOAD_ERROR}
        title="시즌을 표시할 수 없습니다"
        onAction={onRetry}
      />
    </div>
  );
}
