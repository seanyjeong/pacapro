/**
 * 학생에게 쓸 주N회 학원비 표 찾기 — 백엔드 utils/tuitionSettings.resolveTuitionTable 과 같은 규칙.
 * 학생 반의 학원비 표 → 없으면 학원 표. 입시/성인 구분은 학원 표에만 있다(반 표는 하나).
 * 반 표가 없으면 지금까지 쓰던 학원 표를 그대로 돌려준다.
 */
export const WEEKLY_TUITION_KEYS = ['weekly_1', 'weekly_2', 'weekly_3', 'weekly_4', 'weekly_5', 'weekly_6', 'weekly_7'] as const;
export type WeeklyTuitionKey = (typeof WEEKLY_TUITION_KEYS)[number];
export type WeeklyTuitionTable = Record<WeeklyTuitionKey, number>;

export function resolveTuitionTable<T>(
  academy: { exam_tuition: T; adult_tuition: T },
  studentType: string,
  classTuition?: T | null,
): T {
  if (classTuition) return classTuition;
  return studentType === 'adult' ? academy.adult_tuition : academy.exam_tuition;
}
