import { SeasonAlert } from '@/features/seasons/season-alert';

interface SeasonListErrorProps {
  message: string;
  onRetry: () => void;
}

export function SeasonListError({ message, onRetry }: SeasonListErrorProps) {
  return (
    <SeasonAlert actionLabel="다시 불러오기" message={message} title="시즌 목록을 불러오지 못했습니다" onAction={onRetry} />
  );
}
