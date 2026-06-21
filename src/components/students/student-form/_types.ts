/**
 * student-form 내부 타입 정의
 */

export interface TuitionByWeeklyCount {
  weekly_1: number;
  weekly_2: number;
  weekly_3: number;
  weekly_4: number;
  weekly_5: number;
  weekly_6: number;
  weekly_7: number;
}

export interface AcademySettings {
  exam_tuition: TuitionByWeeklyCount;
  adult_tuition: TuitionByWeeklyCount;
  tuition_due_day?: number;
  morning_class_time?: string;
  afternoon_class_time?: string;
  evening_class_time?: string;
}

export const DEFAULT_TUITION: TuitionByWeeklyCount = {
  weekly_1: 0,
  weekly_2: 0,
  weekly_3: 0,
  weekly_4: 0,
  weekly_5: 0,
  weekly_6: 0,
  weekly_7: 0,
};
