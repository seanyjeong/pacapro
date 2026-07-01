import type { Season, TimeSlot } from '@/lib/types/season';

export interface SeasonEnrollStudent {
  id: number;
  name: string;
  phone: string;
  grade: string;
  grade_type: string;
  student_type?: string;
  status?: string | null;
  is_trial?: boolean | number | null;
  is_season_registered: boolean;
  current_season_id: number | null;
}

export interface SeasonEnrollLoadResult {
  season: Season;
  students: SeasonEnrollStudent[];
}

export interface SeasonEnrollPayload {
  student_id: number;
  season_fee: number;
  discount_amount: number;
  time_slots: TimeSlot[];
}
