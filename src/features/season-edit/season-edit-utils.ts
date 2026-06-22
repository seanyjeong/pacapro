import type { GradeTimeSlots, Season, SeasonFormData, SeasonStatus, SeasonType } from '@/lib/types/season';
import { parseOperatingDays } from '@/lib/types/season';

export const SEASON_EDIT_LOAD_ERROR = '시즌 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const SEASON_EDIT_SAVE_ERROR = '시즌을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.';
const DEFAULT_TIME_SLOTS: GradeTimeSlots = { '고3': ['evening'], 'N수': ['morning'] };
const CONTINUOUS_TARGET_SEASON_TYPE: SeasonType = 'regular';

export interface SeasonEditRequest {
  allows_continuous: boolean;
  continuous_discount_rate: number;
  continuous_discount_type: SeasonFormData['continuous_discount_type'];
  continuous_to_season_type: SeasonType | null;
  default_season_fee: number;
  grade_time_slots: SeasonFormData['grade_time_slots'];
  non_season_end_date: string;
  operating_days: number[];
  season_end_date: string;
  season_name: string;
  season_start_date: string;
  season_type: SeasonType;
  status: SeasonStatus;
}

export function mapSeasonToEditForm(season: Season): SeasonFormData {
  return {
    continuous_discount_rate: season.continuous_discount_rate || 0,
    continuous_discount_type: season.continuous_discount_type || 'none',
    end_date: season.season_end_date,
    grade_time_slots: normalizeGradeTimeSlots(season.grade_time_slots),
    non_season_end_date: season.non_season_end_date || '',
    operating_days: parseOperatingDays(season.operating_days),
    season_fee: Number.parseFloat(season.default_season_fee) || 0,
    season_name: season.season_name,
    season_type: season.season_type,
    start_date: season.season_start_date,
    status: season.status,
    year: new Date(season.season_start_date).getFullYear(),
  };
}

export function validateSeasonEditForm(formData: SeasonFormData): string | null {
  if (!formData.season_name.trim()) return '시즌명을 입력해주세요.';
  if (!formData.start_date) return '시즌 시작일을 입력해주세요.';
  if (!formData.end_date) return '시즌 종료일을 입력해주세요.';
  if (formData.operating_days.length === 0) return '운영 요일을 하나 이상 선택해주세요.';
  if (formData.start_date >= formData.end_date) return '시즌 종료일은 시작일보다 뒤여야 합니다.';
  return null;
}

export function buildSeasonEditPayload(formData: SeasonFormData): SeasonEditRequest {
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
    season_name: formData.season_name.trim(),
    season_start_date: formData.start_date,
    season_type: formData.season_type,
    status: formData.status || 'draft',
  };
}

function normalizeGradeTimeSlots(value: Season['grade_time_slots']): GradeTimeSlots {
  const parsed = parseGradeTimeSlots(value);
  Object.keys(parsed).forEach((grade) => {
    const slots = parsed[grade];
    parsed[grade] = Array.isArray(slots) ? slots : [slots].filter(Boolean);
  });
  return { ...DEFAULT_TIME_SLOTS, ...parsed };
}

function parseGradeTimeSlots(value: Season['grade_time_slots']): GradeTimeSlots {
  if (!value) return DEFAULT_TIME_SLOTS;
  if (typeof value !== 'string') return { ...value };
  try {
    return JSON.parse(value) as GradeTimeSlots;
  } catch {
    return DEFAULT_TIME_SLOTS;
  }
}

function getPreviousDate(dateValue: string): string {
  const date = new Date(dateValue);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}
