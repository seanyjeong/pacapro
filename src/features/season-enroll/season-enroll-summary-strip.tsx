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
  const items = [
    { label: '등록 가능', value: `${availableCount}명` },
    { label: '등록 완료', value: `${enrolledCount}명` },
    { label: '대상 학생', value: `${totalEligibleCount}명` },
    { label: '기본 시즌비', value: formatWon(parseSeasonFee(season)) },
  ];

  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-b border-r border-slate-200 px-4 py-3 last:border-r-0 md:border-b-0">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-1 text-lg font-semibold tracking-normal text-slate-950">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
