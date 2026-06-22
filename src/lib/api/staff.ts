/**
 * 직원 관리 API 클라이언트
 */

import apiClient from './client';
import type { APIRequestConfig } from './client';
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
  getStaffList: async (config?: APIRequestConfig): Promise<{ staff: Staff[] }> => {
    return await apiClient.get('/staff', config);
  },

  /**
   * 권한 부여 가능한 강사 목록 조회
   */
  getAvailableInstructors: async (config?: APIRequestConfig): Promise<{ instructors: AvailableInstructor[] }> => {
    return await apiClient.get('/staff/available-instructors', config);
  },

  /**
   * 직원 상세 조회
   */
  getStaff: async (id: number, config?: APIRequestConfig): Promise<{ staff: Staff }> => {
    return await apiClient.get(`/staff/${id}`, config);
  },

  /**
   * 직원 생성 (강사에게 권한 부여)
   */
  createStaff: async (data: CreateStaffRequest, config?: APIRequestConfig): Promise<{ staff: Staff }> => {
    return await apiClient.post('/staff', data, config);
  },

  /**
   * 직원 정보 수정
   */
  updateStaff: async (id: number, data: UpdateStaffRequest, config?: APIRequestConfig): Promise<void> => {
    await apiClient.put(`/staff/${id}`, data, config);
  },

  /**
   * 직원 권한만 수정
   */
  updatePermissions: async (id: number, permissions: Permissions, config?: APIRequestConfig): Promise<void> => {
    await apiClient.put(`/staff/${id}/permissions`, { permissions }, config);
  },

  /**
   * 직원 삭제
   */
  deleteStaff: async (id: number, config?: APIRequestConfig): Promise<void> => {
    await apiClient.delete(`/staff/${id}`, config);
  },

  /**
   * 페이지 권한 목록 조회
   */
  getPermissionPages: async (config?: APIRequestConfig): Promise<{ pages: PermissionPage[] }> => {
    return await apiClient.get('/staff/permissions/pages', config);
  },
};

export default staffApi;
