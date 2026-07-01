export type SeasonMonthlyPolicy = 'season_replaces_monthly' | 'season_plus_monthly';

export const DEFAULT_SEASON_MONTHLY_POLICY: SeasonMonthlyPolicy = 'season_replaces_monthly';

export const SEASON_MONTHLY_POLICY_OPTIONS: Array<{
  value: SeasonMonthlyPolicy;
  label: string;
  detail: string;
  summary: string;
}> = [
  {
    value: 'season_replaces_monthly',
    label: '시즌비가 월납부를 대체',
    detail: '시즌 기간에는 월 학원비 자동 청구를 막고, 시즌 종료 다음 달부터 다시 생성합니다.',
    summary: '시즌비만 청구',
  },
  {
    value: 'season_plus_monthly',
    label: '시즌비와 월납부 함께 청구',
    detail: '시즌 특강비와 기존 월 학원비를 둘 다 청구합니다.',
    summary: '함께 청구',
  },
];

export function normalizeSeasonMonthlyPolicy(
  value: unknown,
  fallback: SeasonMonthlyPolicy = DEFAULT_SEASON_MONTHLY_POLICY
): SeasonMonthlyPolicy {
  return value === 'season_plus_monthly' || value === 'season_replaces_monthly' ? value : fallback;
}
