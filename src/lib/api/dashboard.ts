import apiClient, { type APIRequestConfig } from './client';
import { DashboardStats } from '../types';

export const dashboardAPI = {
    /**
     * 대시보드 통계 조회
     */
    async getStats(config?: APIRequestConfig): Promise<DashboardStats> {
        const response = await apiClient.get<DashboardStats>('/reports/dashboard', config);
        return response;
    },
};
