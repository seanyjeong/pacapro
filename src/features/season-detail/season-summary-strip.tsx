import { Calendar, DollarSign, Trophy, Users } from 'lucide-react';
import type { Season } from '@/lib/types/season';
import { formatOperatingDays, formatSeasonFee, parseOperatingDays } from '@/lib/types/season';

interface SeasonSummaryStripProps {
  season: Season;
  enrolledCount: number;
}

export function SeasonSummaryStrip({ season, enrolledCount }: SeasonSummaryStripProps) {
  const items = [
    { label: '시즌 기간', value: season.season_start_date, meta: `~ ${season.season_end_date}`, icon: Calendar },
    { label: '시즌비', value: formatSeasonFee(season.default_season_fee), meta: '기본 등록 금액', icon: DollarSign },
    {
      label: '운영 요일',
      value: formatOperatingDays(parseOperatingDays(season.operating_days)) || '-',
      meta: '시즌 수업 기준',
      icon: Trophy,
    },
    { label: '등록 학생', value: `${enrolledCount}명`, meta: '현재 등록 기준', icon: Users },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="시즌 요약">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="truncate text-lg font-semibold text-foreground">{item.value}</p>
                <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
              </div>
              <Icon className="h-5 w-5 shrink-0 text-primary" />
            </div>
          </div>
        );
      })}
    </section>
  );
}
