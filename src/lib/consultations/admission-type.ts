export const CONSULTATION_ADMISSION_TYPE_LABELS = {
  early: '수시',
  regular: '정시',
  both: '수시+정시',
} as const;

export type ConsultationAdmissionType = keyof typeof CONSULTATION_ADMISSION_TYPE_LABELS;

export function getConsultationAdmissionTypeLabel(value: unknown): string {
  if (typeof value !== 'string') return '확인 필요';

  return CONSULTATION_ADMISSION_TYPE_LABELS[value as ConsultationAdmissionType] ?? '확인 필요';
}
