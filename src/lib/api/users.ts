import apiClient from './client';

export interface PendingUser {
    id: number;
    email: string;
    name: string;
    phone: string;
    role: string;
    approval_status: string;
    created_at: string;
    academy_name: string;
}

export interface UsersResponse {
    message: string;
    users: PendingUser[];
}

export interface UserActionResponse {
    message: string;
    user: PendingUser;
}

export const usersAPI = {
    /**
     * 승인 대기 중인 사용자 목록 조회
     */
    async getPendingUsers(): Promise<UsersResponse> {
        return apiClient.get('/users/pending', { suppressErrorToast: true });
    },

    /**
     * 사용자 승인
     */
    async approveUser(userId: number): Promise<UserActionResponse> {
        return apiClient.post(`/users/approve/${userId}`, undefined, { suppressErrorToast: true });
    },

    /**
     * 사용자 거절
     */
    async rejectUser(userId: number): Promise<UserActionResponse> {
        return apiClient.post(`/users/reject/${userId}`, undefined, { suppressErrorToast: true });
    },

    /**
     * 전체 사용자 목록 조회
     */
    async getAllUsers(filters?: { role?: string; approval_status?: string }): Promise<UsersResponse> {
        return apiClient.get('/users', { params: filters });
    },

    /**
     * 사용자 상세 조회
     */
    async getUserById(userId: number): Promise<{ user: PendingUser }> {
        return apiClient.get(`/users/${userId}`);
    },
};
