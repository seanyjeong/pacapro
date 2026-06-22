import type {
  AcademySettings,
  ClassTimeKey,
  SeasonFeeKey,
  SettingsSelectOption,
  TuitionByWeeklyCount,
  TuitionKind,
  WeeklyTuitionKey,
} from './settings-types';

export const DEFAULT_TUITION: TuitionByWeeklyCount = {
  weekly_1: 0,
  weekly_2: 0,
  weekly_3: 0,
  weekly_4: 0,
  weekly_5: 0,
  weekly_6: 0,
  weekly_7: 0,
};

export const DEFAULT_SEASON_FEES = {
  exam_early: 0,
  exam_regular: 0,
  civil_service: 0,
};

export const DEFAULT_ACADEMY_SETTINGS: AcademySettings = {
  academy_name: '',
  phone: '',
  address: '',
  business_number: '',
  tuition_due_day: 5,
  salary_payment_day: 10,
  salary_month_type: 'next',
  morning_class_time: '09:30-12:00',
  afternoon_class_time: '14:00-18:00',
  evening_class_time: '18:30-21:00',
  exam_tuition: { ...DEFAULT_TUITION },
  adult_tuition: { ...DEFAULT_TUITION },
  season_fees: { ...DEFAULT_SEASON_FEES },
};

export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = (index % 2) * 30;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

export const TUITION_DUE_DAY_OPTIONS: SettingsSelectOption<number>[] = Array.from({ length: 28 }, (_, index) => {
  const day = index + 1;
  return { value: day, label: `매월 ${day}일` };
});

export const SALARY_DAY_OPTIONS: SettingsSelectOption<number>[] = [
  { value: 1, label: '매월 1일' },
  { value: 5, label: '매월 5일' },
  { value: 10, label: '매월 10일' },
  { value: 15, label: '매월 15일' },
  { value: 20, label: '매월 20일' },
  { value: 0, label: '매월 말일' },
];

export const SALARY_MONTH_TYPE_OPTIONS = [
  { value: 'next', label: '익월 정산', detail: '10월 근무분을 11월 급여일에 지급' },
  { value: 'current', label: '당월 정산', detail: '10월 근무분을 10월 급여일에 지급' },
] as const;

export const CLASS_TIME_FIELDS: Array<{ key: ClassTimeKey; label: string; tone: string }> = [
  { key: 'morning_class_time', label: '오전반', tone: 'border-amber-200 bg-amber-50/70 text-amber-900' },
  { key: 'afternoon_class_time', label: '오후반', tone: 'border-sky-200 bg-sky-50/70 text-sky-900' },
  { key: 'evening_class_time', label: '저녁반', tone: 'border-violet-200 bg-violet-50/70 text-violet-900' },
];

export const WEEKLY_TUITION_FIELDS: Array<{ key: WeeklyTuitionKey; label: string }> = [
  { key: 'weekly_1', label: '주1회' },
  { key: 'weekly_2', label: '주2회' },
  { key: 'weekly_3', label: '주3회' },
  { key: 'weekly_4', label: '주4회' },
  { key: 'weekly_5', label: '주5회' },
  { key: 'weekly_6', label: '주6회' },
  { key: 'weekly_7', label: '주7회' },
];

export const TUITION_SECTIONS: Array<{ kind: TuitionKind; title: string; description: string }> = [
  { kind: 'exam_tuition', title: '입시반 학원비', description: '주 수업 횟수별 월 학원비' },
  { kind: 'adult_tuition', title: '공무원/성인반 학원비', description: '주 수업 횟수별 월 학원비' },
];

export const SEASON_FEE_FIELDS: Array<{ key: SeasonFeeKey; label: string }> = [
  { key: 'exam_early', label: '입시 - 수시' },
  { key: 'exam_regular', label: '입시 - 정시' },
  { key: 'civil_service', label: '공무원' },
];
