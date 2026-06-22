import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SeasonAlert } from '@/features/seasons/season-alert';
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
      <SeasonAlert
        actionLabel="다시 불러오기"
        message={message ?? SEASON_ENROLL_LOAD_ERROR}
        title="시즌 등록 정보를 불러오지 못했습니다"
        onAction={onRetry}
      />
    </div>
  );
}
