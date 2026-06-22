import { Button } from '@/components/ui/button';
import { SeasonAlert } from '@/features/seasons/season-alert';

interface SeasonEditErrorProps {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}

export function SeasonEditError({ message, onBack, onRetry }: SeasonEditErrorProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <SeasonAlert actionLabel="다시 불러오기" message={message} title="시즌 정보를 불러오지 못했습니다" onAction={onRetry} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onBack}>목록으로</Button>
      </div>
    </div>
  );
}
