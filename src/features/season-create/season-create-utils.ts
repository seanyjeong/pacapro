import { DEFAULT_SEASON_MONTHLY_POLICY } from '@/lib/season-monthly-policy';
import type { SeasonFormData, SeasonType } from '@/lib/types/season';

export const SEASON_CREATE_SAVE_ERROR = '시즌을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.';
const CONTINUOUS_TARGET_SEASON_TYPE: SeasonType = 'regular';

export interface SeasonCreateRequest {
  allows_continuous: boolean;
  continuous_discount_rate: number;
  continuous_discount_type: SeasonFormData['continuous_discount_type'];
  continuous_to_season_type: SeasonType | null;
  default_season_fee: number;
  grade_time_slots: SeasonFormData['grade_time_slots'];
  non_season_end_date: string;
  operating_days: number[];
  season_end_date: string;
  season_monthly_policy: SeasonFormData['season_monthly_policy'];
  season_name: string;
  season_start_date: string;
  season_type: SeasonType;
}

export function createInitialSeasonForm(currentYear = new Date().getFullYear()): SeasonFormData {
  return {
    season_name: '',
    season_type: 'early',
    year: currentYear,
    start_date: '',
    end_date: '',
    non_season_end_date: '',
    operating_days: [1, 2, 3, 4, 5, 6],
    grade_time_slots: { '고3': ['evening'], 'N수': ['morning'] },
    season_fee: 0,
    season_monthly_policy: DEFAULT_SEASON_MONTHLY_POLICY,
    continuous_discount_type: 'none',
    continuous_discount_rate: 0,
    status: 'draft',
  };
}

export function validateSeasonCreateForm(formData: SeasonFormData): string | null {
  if (!formData.season_name.trim()) return '시즌명을 입력해주세요.';
  if (!formData.start_date) return '시즌 시작일을 입력해주세요.';
  if (!formData.end_date) return '시즌 종료일을 입력해주세요.';
  if (formData.operating_days.length === 0) return '운영 요일을 하나 이상 선택해주세요.';
  if (formData.start_date >= formData.end_date) return '시즌 종료일은 시작일보다 뒤여야 합니다.';
  return null;
}

export function buildSeasonCreatePayload(formData: SeasonFormData): SeasonCreateRequest {
  const allowsContinuous = formData.continuous_discount_type !== 'none';
  return {
    allows_continuous: allowsContinuous,
    continuous_discount_rate: formData.continuous_discount_rate || 0,
    continuous_discount_type: formData.continuous_discount_type || 'none',
    continuous_to_season_type: allowsContinuous ? CONTINUOUS_TARGET_SEASON_TYPE : null,
    default_season_fee: formData.season_fee,
    grade_time_slots: formData.grade_time_slots,
    non_season_end_date: formData.non_season_end_date || getPreviousDate(formData.start_date),
    operating_days: formData.operating_days,
    season_end_date: formData.end_date,
    season_monthly_policy: formData.season_monthly_policy || DEFAULT_SEASON_MONTHLY_POLICY,
    season_name: formData.season_name.trim(),
    season_start_date: formData.start_date,
    season_type: formData.season_type,
  };
}

function getPreviousDate(dateValue: string): string {
  const date = new Date(dateValue);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}
