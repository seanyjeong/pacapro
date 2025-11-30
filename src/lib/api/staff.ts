/**
 * 직원 관리 API 클라이언트
 */

import apiClient from './client';
import type {
  Staff,
  AvailableInstructor,
  CreateStaffRequest,
  UpdateStaffRequest,
  Permissions,
  PermissionPage,
} from '@/lib/types/staff';

export const staffApi = {
  /**
   * 직원 목록 조회
   */
  getStaffList: async (): Promise<{ staff: Staff[] }> => {
    return await apiClient.get('/staff');
  },

  /**
   * 권한 부여 가능한 강사 목록 조회
   */
  getAvailableInstructors: async (): Promise<{ instructors: AvailableInstructor[] }> => {
    return await apiClient.get('/staff/available-instructors');
  },

  /**
   * 직원 상세 조회
   */
  getStaff: async (id: number): Promise<{ staff: Staff }> => {
    return await apiClient.get(`/staff/${id}`);
  },

  /**
   * 직원 생성 (강사에게 권한 부여)
   */
  createStaff: async (data: CreateStaffRequest): Promise<{ staff: Staff }> => {
    return await apiClient.post('/staff', data);
  },

  /**
   * 직원 정보 수정
   */
  updateStaff: async (id: number, data: UpdateStaffRequest): Promise<void> => {
    await apiClient.put(`/staff/${id}`, data);
  },

  /**
   * 직원 권한만 수정
   */
  updatePermissions: async (id: number, permissions: Permissions): Promise<void> => {
    await apiClient.put(`/staff/${id}/permissions`, { permissions });
  },

  /**
   * 직원 삭제
   */
  deleteStaff: async (id: number): Promise<void> => {
    await apiClient.delete(`/staff/${id}`);
  },

  /**
   * 페이지 권한 목록 조회
   */
  getPermissionPages: async (): Promise<{ pages: PermissionPage[] }> => {
    return await apiClient.get('/staff/permissions/pages');
  },
};

export default staffApi;
