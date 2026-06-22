import type { OnboardingFormData, OnboardingStepDefinition, TimeSlotDefinition } from './onboarding-types';

export const SESSION_COUNTS = [1, 2, 3, 4, 5, 6, 7] as const;
export const PAYMENT_DAYS = [1, 5, 10, 15, 20, 25, 0] as const;
export const TUITION_DUE_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

export const DEFAULT_TUITION_SETTINGS = {
  exam_tuition: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
  adult_tuition: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
};

export const DEFAULT_ONBOARDING_FORM: OnboardingFormData = {
  academy_name: '',
  phone: '',
  address: '',
  business_number: '',
  morning_class_time: '09:30-12:00',
  afternoon_class_time: '14:00-18:00',
  evening_class_time: '18:30-21:00',
  tuition_settings: DEFAULT_TUITION_SETTINGS,
  salary_payment_day: 10,
  salary_month_type: 'next',
  tuition_due_day: 5,
  create_sample_data: false,
};

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    id: 1,
    title: '학원 정보',
    shortTitle: '정보',
    description: '표시명, 연락처, 주소를 운영 기준으로 정리합니다.',
    nextLabel: '다음: 수업 시간',
  },
  {
    id: 2,
    title: '수업 시간',
    shortTitle: '시간',
    description: '오전, 오후, 저녁반의 기본 시간대를 설정합니다.',
    nextLabel: '다음: 학원비',
  },
  {
    id: 3,
    title: '학원비',
    shortTitle: '학원비',
    description: '주당 수업 횟수별 기본 수강료를 입력합니다.',
    nextLabel: '다음: 정산',
  },
  {
    id: 4,
    title: '정산 설정',
    shortTitle: '정산',
    description: '급여 지급일과 학원비 기본 납부일을 맞춥니다.',
    nextLabel: '다음: 검토',
  },
  {
    id: 5,
    title: '검토 후 시작',
    shortTitle: '검토',
    description: '저장 전 핵심 설정을 마지막으로 확인합니다.',
  },
];

export const TIME_SLOTS: TimeSlotDefinition[] = [
  { key: 'morning_class_time', label: '오전반', helper: '등원 직후 첫 수업 기준' },
  { key: 'afternoon_class_time', label: '오후반', helper: '학교 수업 이후 운영 기준' },
  { key: 'evening_class_time', label: '저녁반', helper: '야간 보강 및 정규 수업 기준' },
];
