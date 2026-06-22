import type { Season } from '@/lib/types/season';

interface SeasonInfoPanelProps {
  season: Season;
}

export function SeasonInfoPanel({ season }: SeasonInfoPanelProps) {
  const rows = [
    { label: '비시즌 종강일', value: season.non_season_end_date || '-' },
    { label: '연속등록 허용', value: season.allows_continuous ? '허용' : '불허' },
    { label: '연속등록 할인', value: getContinuousDiscountLabel(season) },
    { label: '연속등록 대상 시즌', value: getContinuousTargetLabel(season) },
  ];

  return (
    <section className="rounded-md border border-border bg-card p-5" aria-labelledby="season-info-title">
      <h2 id="season-info-title" className="text-lg font-semibold text-foreground">
        시즌 정보
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border border-border/80 bg-muted/25 p-3">
            <p className="text-sm text-muted-foreground">{row.label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{row.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function getContinuousDiscountLabel(season: Season): string {
  if (!season.allows_continuous) return '-';
  if (season.continuous_discount_type === 'free') return '무료';
  if (season.continuous_discount_type === 'rate') return `${season.continuous_discount_rate}% 할인`;
  return '없음';
}

function getContinuousTargetLabel(season: Season): string {
  if (!season.allows_continuous) return '-';
  if (season.continuous_to_season_type === 'early') return '수시';
  if (season.continuous_to_season_type === 'regular') return '정시';
  return '-';
}
