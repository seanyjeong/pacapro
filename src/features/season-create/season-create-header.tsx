import { SeasonPageHeader } from '@/features/seasons/season-page-header';

interface SeasonCreateHeaderProps {
  onBack: () => void;
}

export function SeasonCreateHeader({ onBack }: SeasonCreateHeaderProps) {
  return <SeasonPageHeader description="수시·정시 시즌 운영 기준을 만들어요." title="시즌 등록" onBack={onBack} />;
}
