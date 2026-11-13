/**
 * 지점·반 API 클라이언트
 */

import apiClient, { type APIRequestConfig } from './client';

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
      instructor_id?: number | null;
    },
    config?: APIRequestConfig,
  ) => apiClient.put(`${BASE_PATH}/classes/${id}`, data, config),
  deleteClass: (id: number, config?: APIRequestConfig) => apiClient.delete(`${BASE_PATH}/classes/${id}`, config),
  assignStudents: (studentIds: number[], placement: StudentPlacement, config?: APIRequestConfig) =>
    apiClient.put(`${BASE_PATH}/students`, { student_ids: studentIds, ...placement }, config),
};
