import type { TuitionSettings } from '@/lib/api/onboarding';

export type SalaryMonthType = 'current' | 'next';

export interface OnboardingFormData {
  academy_name: string;
  phone: string;
  address: string;
  business_number: string;
  morning_class_time: string;
  afternoon_class_time: string;
  evening_class_time: string;
  tuition_settings: Required<TuitionSettings>;
  salary_payment_day: number;
  salary_month_type: SalaryMonthType;
  tuition_due_day: number;
  create_sample_data: boolean;
}

export type OnboardingField = keyof OnboardingFormData;

export type UpdateOnboardingField = <K extends OnboardingField>(
  field: K,
  value: OnboardingFormData[K],
) => void;

export type OnboardingStepId = 1 | 2 | 3 | 4 | 5;

export interface OnboardingStepDefinition {
  id: OnboardingStepId;
  title: string;
  shortTitle: string;
  description: string;
  nextLabel?: string;
}

export interface TimeSlotDefinition {
  key: 'morning_class_time' | 'afternoon_class_time' | 'evening_class_time';
  label: string;
  helper: string;
}
