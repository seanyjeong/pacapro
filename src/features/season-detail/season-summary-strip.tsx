import { Calendar, DollarSign, Trophy, Users } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { Season } from '@/lib/types/season';
import { formatOperatingDays, formatSeasonFee, parseOperatingDays } from '@/lib/types/season';

interface SeasonSummaryStripProps {
  season: Season;
  enrolledCount: number;
}

export function SeasonSummaryStrip({ season, enrolledCount }: SeasonSummaryStripProps) {
  const items = [
    { label: '시즌 기간', value: season.season_start_date, meta: `~ ${season.season_end_date}`, icon: Calendar, tone: 'neutral' as const },
    { label: '시즌비', value: formatSeasonFee(season.default_season_fee), meta: '기본 등록 금액', icon: DollarSign, tone: 'success' as const },
    {
      label: '운영 요일',
      value: formatOperatingDays(parseOperatingDays(season.operating_days)) || '-',
      meta: '시즌 수업 기준',
      icon: Trophy,
      tone: 'warning' as const,
    },
    { label: '등록 학생', value: `${enrolledCount}명`, meta: '현재 등록 기준', icon: Users, tone: 'primary' as const },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="시즌 요약">
      {items.map((item) => (
        <StatTile
          key={item.label}
          icon={item.icon}
          label={item.label}
          note={<span className="block truncate text-muted-foreground">{item.meta}</span>}
          tone={item.tone}
          value={<span className="block truncate text-[19px] sm:text-[22px]">{item.value}</span>}
        />
      ))}
    </section>
  );
}
