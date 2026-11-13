/**
 * 반 명단 출석 — 출석 화면에서 반을 고르면 그 반 재원생 전원을 보여 준다.
 * 그날 수업에 없던 학생(assigned: false)은 체크하는 순간 수업에 넣는다.
 */

import apiClient, { type APIRequestConfig } from '@/lib/api/client';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export interface ClassRosterStudent {
  student_id: number;
  student_name: string;
  student_number: string | null;
  grade: string | null;
  phone: string | null;
  parent_phone: string | null;
  attendance_status: string | null;
  notes: string | null;
  is_makeup: number;
  assigned: boolean;
}

export interface ClassRoster {
  schedule: { id: number } | null;
  students: ClassRosterStudent[];
}

/** 그날 수업에 아직 없는 반 학생 — 출석 화면 학생 타입에 그대로 들어간다. */
export interface UnassignedClassStudent {
  student_id: number;
  student_name: string;
  grade?: string;
  phone: string | null;
  parent_phone: string | null;
  attendance_status: null;
  notes: null;
  assigned: false;
}

export function getClassRoster(date: string, classId: number, timeSlot: string): Promise<ClassRoster> {
  return apiClient.get<ClassRoster>(
    `/schedules/class-roster?date=${date}&class_id=${classId}&time_slot=${timeSlot}`,
    SILENT_CONFIG
  );
}

/** 반 학생을 그날 수업에 넣고, 그 수업 id 를 돌려준다(수업이 없었으면 새로 생긴다). */
export async function assignClassStudents(
  date: string,
  timeSlot: string,
  classId: number,
  studentIds: number[]
): Promise<number | null> {
  for (const studentId of studentIds) {
    await apiClient.post<void>('/schedules/slot/student', { date, time_slot: timeSlot, student_id: studentId }, SILENT_CONFIG);
  }
  const roster = await getClassRoster(date, classId, timeSlot);
  return roster.schedule?.id ?? null;
}

/** 반 명단 순서로, 그날 수업에 있는 학생은 수업 쪽 정보를 쓰고 없는 학생은 미배정으로 붙인다. */
export function withClassRoster<T extends { student_id: number }>(
  slotStudents: T[],
  roster: ClassRosterStudent[]
): Array<T | UnassignedClassStudent> {
  const assigned = new Map(slotStudents.map((student) => [student.student_id, student]));
  return roster.map((student) => assigned.get(student.student_id) ?? {
    student_id: student.student_id,
    student_name: student.student_name,
    grade: student.grade ?? undefined,
    phone: student.phone,
    parent_phone: student.parent_phone,
    attendance_status: null,
    notes: null,
    assigned: false,
  });
}
