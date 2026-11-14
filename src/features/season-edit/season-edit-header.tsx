import { SeasonPageHeader } from '@/features/seasons/season-page-header';

interface SeasonEditHeaderProps {
  onBack: () => void;
}

export function SeasonEditHeader({ onBack }: SeasonEditHeaderProps) {
  return <SeasonPageHeader description="시즌 운영 기준과 상태를 고쳐요." title="시즌 수정" onBack={onBack} />;
}
