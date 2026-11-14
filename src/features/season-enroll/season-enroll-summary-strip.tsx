import { CheckCircle2, UserPlus, Users, WalletCards } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { Season } from '@/lib/types/season';
import { formatWon, parseSeasonFee } from './season-enroll-utils';

interface SeasonEnrollSummaryStripProps {
  availableCount: number;
  enrolledCount: number;
  season: Season;
  totalEligibleCount: number;
}

export function SeasonEnrollSummaryStrip({
  availableCount,
  enrolledCount,
  season,
  totalEligibleCount,
}: SeasonEnrollSummaryStripProps) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="시즌 등록 요약">
      <StatTile icon={UserPlus} label="등록 가능" tone="primary" value={`${availableCount}명`} />
      <StatTile icon={CheckCircle2} label="등록 완료" tone="success" value={`${enrolledCount}명`} />
      <StatTile icon={Users} label="대상 학생" value={`${totalEligibleCount}명`} />
      <StatTile
        icon={WalletCards}
        label="기본 시즌비"
        tone="warning"
        value={<span className="text-[20px] sm:text-[26px]">{formatWon(parseSeasonFee(season))}</span>}
      />
    </section>
  );
}
