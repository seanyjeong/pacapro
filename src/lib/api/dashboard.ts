import apiClient, { type APIRequestConfig } from './client';
import { DashboardStats } from '../types';

export const dashboardAPI = {
    /**
     * 대시보드 통계 조회
     */
    async getStats(config?: APIRequestConfig, branchIds: number[] = []): Promise<DashboardStats> {
        // 지점을 주면 학생 수와 학원비 매출·미납만 그 지점 기준(0 = 지점 없음)
        const query = branchIds.length ? `?branch_ids=${branchIds.join(',')}` : '';
        const response = await apiClient.get<DashboardStats>(`/reports/dashboard${query}`, config);
        return response;
    },
};
