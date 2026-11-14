/**
 * 지점·반 API 클라이언트
 */

import apiClient, { type APIRequestConfig } from './client';
import type { WeeklyTuitionTable } from '@/lib/utils/tuition-table';

export type BranchStatus = 'active' | 'inactive';
export type BranchTimeSlot = 'morning' | 'afternoon' | 'evening';

interface BranchCounts {
  student_count: number;
  active_count: number;
}

export interface BranchClass extends BranchCounts {
  id: number;
  branch_id: number;
  class_name: string;
  default_time_slot: BranchTimeSlot;
  class_days: number[]; // 반 수업 요일 0(일)~6(토), 안 정했으면 빈 배열
  instructor_id: number | null; // 담당 강사(표시용). 근무 일정·급여와 무관
  instructor_name?: string | null;
  sort_order: number;
  status: BranchStatus;
  tuition_by_weekly: WeeklyTuitionTable | null; // 이 반만 따로 정한 주1~7회 학원비. null 이면 학원 기본표
}

export interface Branch extends BranchCounts {
  id: number;
  name: string;
  sort_order: number;
  status: BranchStatus;
  classes: BranchClass[];
}

export interface BranchTree {
  branches: Branch[];
  unassigned: BranchCounts;
}

export interface StudentPlacement {
  branch_id: number | null;
  class_id: number | null;
}

// 같이 바뀌는 이번 달부터의 미납 월 청구(학생 수정과 같은 식). 낸 청구·일할 청구는 들어 있지 않다.
export interface PendingBillChange {
  id: number;
  year_month: string;
  current_amount: number;
  new_amount: number;
}

// 학원비 다시 계산 한 줄: 지금 금액 → 새 금액(반 표, 없으면 학원 표). new_tuition null = 표에 금액 없음
export interface TuitionChange {
  student_id: number;
  name: string;
  status: string;
  weekly_count: number;
  current_tuition: number;
  new_tuition: number | null;
  discount_rate: number;
  new_final_tuition: number | null;
  changed: boolean;
  individual: boolean; // 예전 표 금액과 다른 개별 금액 — 처음엔 고르지 않는다
  pending_bills: PendingBillChange[]; // 휴원 학생은 비어 있다(복귀 때 맞춤)
}

export interface ClassTuitionPreview {
  class: { id: number; class_name: string; tuition_by_weekly: WeeklyTuitionTable | null };
  students: TuitionChange[];
}

// 확인한 지금·새 금액. 서버가 다시 계산한 금액과 다르면 409 로 아무것도 바꾸지 않는다.
const confirmed = (changes: TuitionChange[]) =>
  changes.map((change) => ({ student_id: change.student_id, current_tuition: change.current_tuition, new_tuition: change.new_tuition }));

// 처음에 고를 학생: 바뀌는 학생 중 개별 금액이 아닌 학생
export const defaultTuitionSelection = (changes: TuitionChange[]) =>
  new Set(changes.filter((change) => change.changed && !change.individual).map((change) => change.student_id));

const BASE_PATH = '/branches';

export const branchesAPI = {
  getTree: (config?: APIRequestConfig): Promise<BranchTree> => apiClient.get(BASE_PATH, config),
  createBranch: (name: string, config?: APIRequestConfig) => apiClient.post(BASE_PATH, { name }, config),
  updateBranch: (id: number, data: { name?: string; status?: BranchStatus }, config?: APIRequestConfig) =>
    apiClient.put(`${BASE_PATH}/${id}`, data, config),
  deleteBranch: (id: number, config?: APIRequestConfig) => apiClient.delete(`${BASE_PATH}/${id}`, config),
  createClass: (branchId: number, className: string, config?: APIRequestConfig) =>
    apiClient.post(`${BASE_PATH}/${branchId}/classes`, { class_name: className }, config),
  updateClass: (
    id: number,
    data: {
      class_name?: string; default_time_slot?: BranchTimeSlot; class_days?: number[]; status?: BranchStatus; branch_id?: number;
      instructor_id?: number | null; tuition_by_weekly?: WeeklyTuitionTable | null;
    },
    config?: APIRequestConfig,
  ) => apiClient.put(`${BASE_PATH}/classes/${id}`, data, config),
  deleteClass: (id: number, config?: APIRequestConfig) => apiClient.delete(`${BASE_PATH}/classes/${id}`, config),
  // tuitionChanges 를 주면(반 이동 때 묻고 고른 학생) 그 학생만 새 반 기준 학원비로 바꾼다.
  assignStudents: (studentIds: number[], placement: StudentPlacement, config?: APIRequestConfig, tuitionChanges?: TuitionChange[]) =>
    apiClient.put(`${BASE_PATH}/students`, {
      student_ids: studentIds, ...placement, ...(tuitionChanges?.length ? { tuition_changes: confirmed(tuitionChanges) } : {}),
    }, config),
  // 반 이동 전에 바뀔 학원비. 새 반(또는 지금 반)에 따로 정한 표가 있을 때만 나온다.
  previewMoveTuition: (studentIds: number[], classId: number | null, config?: APIRequestConfig): Promise<{ changes: TuitionChange[] }> =>
    apiClient.post(`${BASE_PATH}/students/tuition-preview`, { student_ids: studentIds, class_id: classId }, config),
  previewClassTuition: (classId: number, config?: APIRequestConfig): Promise<ClassTuitionPreview> =>
    apiClient.get(`${BASE_PATH}/classes/${classId}/tuition-preview`, config),
  applyClassTuition: (classId: number, changes: TuitionChange[], config?: APIRequestConfig): Promise<{ message: string; updated: number }> =>
    apiClient.post(`${BASE_PATH}/classes/${classId}/apply-tuition`, { changes: confirmed(changes) }, config),
};
