import type { OnboardingCompletePayload, OnboardingData, TuitionSettings } from '@/lib/api/onboarding';
import { DEFAULT_ONBOARDING_FORM, DEFAULT_TUITION_SETTINGS } from './onboarding-constants';
import type { OnboardingFormData, OnboardingStepId } from './onboarding-types';

type TuitionKey = 'exam_tuition' | 'adult_tuition';

export function parseTimeRange(value: string) {
  const [start = '', end = ''] = value.split('-');
  return { start, end };
}

export function formatWon(value: number) {
  return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '0';
}

export function normalizeNumberInput(value: string) {
  return Number.parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

export function normalizeTuitionSettings(settings: TuitionSettings | string | null): Required<TuitionSettings> {
  const parsed = typeof settings === 'string' ? parseJsonSettings(settings) : settings;

  return {
    exam_tuition: normalizeTuitionBucket(parsed?.exam_tuition, 'exam_tuition'),
    adult_tuition: normalizeTuitionBucket(parsed?.adult_tuition, 'adult_tuition'),
  };
}

function parseJsonSettings(settings: string): TuitionSettings | null {
  try {
    return JSON.parse(settings) as TuitionSettings;
  } catch {
    return null;
  }
}

function normalizeTuitionBucket(bucket: Record<string, number> | undefined, key: TuitionKey) {
  return Object.fromEntries(
    Object.entries(DEFAULT_TUITION_SETTINGS[key]).map(([session, defaultValue]) => [
      session,
      Number(bucket?.[session] ?? defaultValue),
    ]),
  );
}

export function formFromOnboardingData(data: OnboardingData): OnboardingFormData {
  return {
    ...DEFAULT_ONBOARDING_FORM,
    academy_name: data.academy.name || '',
    phone: data.academy.phone || '',
    address: data.academy.address || '',
    business_number: data.academy.business_number || '',
    morning_class_time: data.settings.morning_class_time || DEFAULT_ONBOARDING_FORM.morning_class_time,
    afternoon_class_time: data.settings.afternoon_class_time || DEFAULT_ONBOARDING_FORM.afternoon_class_time,
    evening_class_time: data.settings.evening_class_time || DEFAULT_ONBOARDING_FORM.evening_class_time,
    salary_payment_day: data.settings.salary_payment_day ?? DEFAULT_ONBOARDING_FORM.salary_payment_day,
    salary_month_type: data.settings.salary_month_type === 'current' ? 'current' : 'next',
    tuition_due_day: data.settings.tuition_due_day ?? DEFAULT_ONBOARDING_FORM.tuition_due_day,
    tuition_settings: normalizeTuitionSettings(data.settings.settings),
  };
}

export function buildOnboardingPayload(formData: OnboardingFormData): OnboardingCompletePayload {
  return {
    academy_name: formData.academy_name.trim(),
    phone: formData.phone.trim(),
    address: formData.address.trim(),
    business_number: formData.business_number.trim(),
    morning_class_time: formData.morning_class_time,
    afternoon_class_time: formData.afternoon_class_time,
    evening_class_time: formData.evening_class_time,
    tuition_settings: formData.tuition_settings,
    salary_payment_day: formData.salary_payment_day,
    salary_month_type: formData.salary_month_type,
    tuition_due_day: formData.tuition_due_day,
  };
}

export function getStepValidationMessage(step: OnboardingStepId, formData: OnboardingFormData) {
  if (step === 1 && formData.academy_name.trim().length === 0) {
    return '학원명을 입력해주세요.';
  }
  return null;
}

export function updateTimeRange(currentValue: string, type: 'start' | 'end', value: string) {
  const current = parseTimeRange(currentValue);
  return type === 'start' ? `${value}-${current.end}` : `${current.start}-${value}`;
}
