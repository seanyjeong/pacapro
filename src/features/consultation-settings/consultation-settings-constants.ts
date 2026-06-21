import type { ChecklistTemplate, ConsultationSettings } from '@/lib/types/consultation';
import type { NewChecklistItemState } from './consultation-settings-types';

export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplate[] = [
  { id: 1, category: '학생 배경', text: '타학원 경험 확인', input: { type: 'text', label: '학원명' } },
  {
    id: 2,
    category: '학생 배경',
    text: '운동 경력 확인',
    inputs: [
      { type: 'radio', label: '과거 선수 경험', options: ['있음', '없음'] },
      { type: 'text', label: '종목' },
    ],
  },
  { id: 3, category: '학생 배경', text: '제멀 기록 확인 (학교 기록)', input: { type: 'text', label: '기록' } },
  { id: 4, category: '체력 및 성향', text: '현재 체력 수준', input: { type: 'radio', label: '체력', options: ['상', '중', '하'] } },
  { id: 5, category: '체력 및 성향', text: '성격/성향 파악', input: { type: 'radio', label: '성향', options: ['외향적', '내향적'] } },
  { id: 6, category: '체력 및 성향', text: '기타 운동 종목', input: { type: 'text', label: '종목' } },
  { id: 7, category: '안내 완료', text: '수시/정시 입시 설명' },
  { id: 8, category: '안내 완료', text: '학원 커리큘럼 안내' },
  { id: 9, category: '안내 완료', text: '수업료 안내' },
  { id: 10, category: '안내 완료', text: '체험 수업 일정 협의' },
  { id: 11, category: '안내 완료', text: '질의응답 완료' },
];

export const INITIAL_CONSULTATION_SETTINGS: Partial<ConsultationSettings> = {
  isEnabled: true,
  pageTitle: '상담 예약',
  pageDescription: '',
  slotDuration: 30,
  maxReservationsPerSlot: 1,
  advanceDays: 30,
  minAdvanceHours: 4,
  referralSources: ['블로그/인터넷 검색', '지인 소개', '현수막/전단지', 'SNS', '기타'],
  sendConfirmationAlimtalk: true,
};

export const INITIAL_CHECKLIST_ITEM: NewChecklistItemState = {
  category: '',
  text: '',
  inputType: 'none',
  inputLabel: '',
  radioOptions: '',
};

export const TIME_OPTIONS = buildTimeOptions();

function buildTimeOptions() {
  const options: string[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      options.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
    }
  }

  options.push('24:00:00');
  return options;
}
