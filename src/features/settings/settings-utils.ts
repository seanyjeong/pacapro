import { DEFAULT_ACADEMY_SETTINGS, WEEKLY_TUITION_FIELDS } from './settings-constants';
import type {
  AcademySettings,
  AcademySettingsPatch,
  OperationSettingsPatch,
  SalaryMonthType,
  SeasonFees,
  TuitionByWeeklyCount,
} from './settings-types';

export function parseTimeRange(timeRange: string): { start: string; end: string } {
  const [start, end] = timeRange.split('-');
  return { start: start || '09:00', end: end || '12:00' };
}

export function formatTimeRange(start: string, end: string): string {
  return `${start}-${end}`;
}

export function getRoleLabel(role?: string): string {
  if (role === 'owner') return '원장';
  if (role === 'admin') return '관리자';
  return '강사';
}

export function getSalaryPayDayLabel(day: number): string {
  return day === 0 ? '말일' : `${day}일`;
}

export function getSalaryExampleRows(settings: AcademySettings): string[] {
  const payDay = getSalaryPayDayLabel(settings.salary_payment_day);
  if (settings.salary_month_type === 'next') {
    return [`11월 ${payDay} 급여: 10월 근무분 정산`, `12월 ${payDay} 급여: 11월 근무분 정산`];
  }
  return [`11월 ${payDay} 급여: 11월 근무분 정산`, `12월 ${payDay} 급여: 12월 근무분 정산`];
}

export function serializeAcademySettings(settings: AcademySettings): string {
  return JSON.stringify(settings);
}

export function normalizeAcademySettings(
  patch: AcademySettingsPatch | null | undefined,
  base: AcademySettings = DEFAULT_ACADEMY_SETTINGS
): AcademySettings {
  const source = toRecord(patch);
  return {
    ...base,
    academy_name: toText(source.academy_name, base.academy_name),
    phone: toText(source.phone, base.phone),
    address: toText(source.address, base.address),
    business_number: toText(source.business_number, base.business_number),
    tuition_due_day: toNumber(source.tuition_due_day, base.tuition_due_day),
    salary_payment_day: toNumber(source.salary_payment_day, base.salary_payment_day),
    salary_month_type: toSalaryMonthType(source.salary_month_type, base.salary_month_type),
    morning_class_time: toText(source.morning_class_time, base.morning_class_time),
    afternoon_class_time: toText(source.afternoon_class_time, base.afternoon_class_time),
    evening_class_time: toText(source.evening_class_time, base.evening_class_time),
    exam_tuition: normalizeTuition(source.exam_tuition, base.exam_tuition),
    adult_tuition: normalizeTuition(source.adult_tuition, base.adult_tuition),
    season_fees: normalizeSeasonFees(source.season_fees, base.season_fees),
  };
}

export function mergeOperationSettings(
  patch: OperationSettingsPatch | null | undefined,
  base: AcademySettings
): AcademySettings {
  const source = toRecord(patch);
  return {
    ...base,
    morning_class_time: toText(source.morning_class_time, base.morning_class_time),
    afternoon_class_time: toText(source.afternoon_class_time, base.afternoon_class_time),
    evening_class_time: toText(source.evening_class_time, base.evening_class_time),
    salary_payment_day: toNumber(source.salary_payment_day, base.salary_payment_day),
    salary_month_type: toSalaryMonthType(source.salary_month_type, base.salary_month_type),
  };
}

function normalizeTuition(value: unknown, base: TuitionByWeeklyCount): TuitionByWeeklyCount {
  const source = toRecord(value);
  return WEEKLY_TUITION_FIELDS.reduce<TuitionByWeeklyCount>(
    (next, field) => ({ ...next, [field.key]: toNumber(source[field.key], base[field.key]) }),
    { ...base }
  );
}

function normalizeSeasonFees(value: unknown, base: SeasonFees): SeasonFees {
  const source = toRecord(value);
  return {
    exam_early: toNumber(source.exam_early, base.exam_early),
    exam_regular: toNumber(source.exam_regular, base.exam_regular),
    civil_service: toNumber(source.civil_service, base.civil_service),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSalaryMonthType(value: unknown, fallback: SalaryMonthType): SalaryMonthType {
  return value === 'current' || value === 'next' ? value : fallback;
}
