export type SalaryMonthType = 'current' | 'next';

export interface TuitionByWeeklyCount {
  weekly_1: number;
  weekly_2: number;
  weekly_3: number;
  weekly_4: number;
  weekly_5: number;
  weekly_6: number;
  weekly_7: number;
}

export type WeeklyTuitionKey = keyof TuitionByWeeklyCount;
export type TuitionKind = 'exam_tuition' | 'adult_tuition';

export interface SeasonFees {
  exam_early: number;
  exam_regular: number;
  civil_service: number;
}

export type SeasonFeeKey = keyof SeasonFees;

export interface AcademySettings {
  academy_name: string;
  phone: string;
  address: string;
  business_number: string;
  tuition_due_day: number;
  salary_payment_day: number;
  salary_month_type: SalaryMonthType;
  morning_class_time: string;
  afternoon_class_time: string;
  evening_class_time: string;
  exam_tuition: TuitionByWeeklyCount;
  adult_tuition: TuitionByWeeklyCount;
  season_fees: SeasonFees;
}

export type ClassTimeKey = 'morning_class_time' | 'afternoon_class_time' | 'evening_class_time';
export type TimeRangePart = 'start' | 'end';

export interface SettingsUser {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
}

export interface AcademySettingsPatch
  extends Partial<Omit<AcademySettings, 'exam_tuition' | 'adult_tuition' | 'season_fees'>> {
  exam_tuition?: Partial<TuitionByWeeklyCount> | null;
  adult_tuition?: Partial<TuitionByWeeklyCount> | null;
  season_fees?: Partial<SeasonFees> | null;
}

export type OperationSettingsPatch = Partial<
  Pick<
    AcademySettings,
    | 'morning_class_time'
    | 'afternoon_class_time'
    | 'evening_class_time'
    | 'salary_payment_day'
    | 'salary_month_type'
  >
>;

export interface AuthMeResponse {
  user: SettingsUser;
}

export interface AcademySettingsResponse {
  settings?: AcademySettingsPatch | null;
}

export interface OperationSettingsResponse {
  settings?: OperationSettingsPatch | null;
}

export interface SettingsSelectOption<T extends string | number> {
  value: T;
  label: string;
}
