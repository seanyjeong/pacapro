export type AdmissionType =
  | 'regular'
  | 'early'
  | 'advance'
  | 'civil_service'
  | 'military_academy'
  | 'police_university';

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  regular: '정시',
  early: '수시',
  advance: '선행반',
  civil_service: '공무원',
  military_academy: '사관학교',
  police_university: '경찰대',
};

export const EXAM_ADMISSION_OPTIONS: Array<{ value: AdmissionType; label: string }> = [
  { value: 'regular', label: '정시' },
  { value: 'early', label: '수시' },
  { value: 'advance', label: '선행반' },
  { value: 'military_academy', label: '사관학교' },
  { value: 'police_university', label: '경찰대' },
];

export const ADULT_ADMISSION_OPTIONS: Array<{ value: AdmissionType; label: string }> = [
  { value: 'civil_service', label: '공무원' },
];

export const ADMISSION_TYPE_OPTIONS: Array<{ value: AdmissionType; label: string }> = [
  ...EXAM_ADMISSION_OPTIONS,
  ...ADULT_ADMISSION_OPTIONS,
];

const ADVANCE_ELIGIBLE_GRADES = new Set(['중1', '중2', '중3', '고1', '고2']);

export function isAdvanceAdmissionGrade(grade?: string): boolean {
  return Boolean(grade && ADVANCE_ELIGIBLE_GRADES.has(grade));
}
