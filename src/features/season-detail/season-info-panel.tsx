import type { Season } from '@/lib/types/season';

interface SeasonInfoPanelProps {
  season: Season;
}

export function SeasonInfoPanel({ season }: SeasonInfoPanelProps) {
  const rows = [
    { label: '비시즌 종강일', value: season.non_season_end_date || '-' },
    { label: '무료 수업 종료일', value: season.free_lesson_end_date || '설정 없음' },
    { label: '무료 수업 종료 후', value: season.post_free_action === 'graduate' ? '다음 날 자동 졸업' : season.post_free_action === 'regular' ? '재원 유지 · 월 수강료 청구' : '설정 없음' },
    { label: '연속등록 허용', value: season.allows_continuous ? '허용' : '불허' },
    { label: '연속등록 할인', value: getContinuousDiscountLabel(season) },
    { label: '연속등록 대상 시즌', value: getContinuousTargetLabel(season) },
  ];

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6" aria-labelledby="season-info-title">
      <h2 id="season-info-title" className="text-[17px] font-bold tracking-tight text-foreground">
        시즌 정보
      </h2>
      <dl className="mt-3 divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-right text-[15px] font-semibold text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
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
