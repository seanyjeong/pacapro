import apiClient from './client';
import type { Permissions } from '@/lib/types/staff';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    message: string;
    token: string;
    user: {
        id: number;
        email: string;
        name: string;
        role: string;
        academy_id: number;
        position?: string;
        permissions?: Permissions;
    };
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    academyName: string;
    phone?: string;
}

export interface RegisterResponse {
    message: string;
    user: {
        id: number;
        email: string;
        name: string;
        role: string;
    };
    academy: {
        id: number;
        name: string;
    };
    token: string;
}

export const authAPI = {
    /**
     * 로그인
     */
    async login(data: LoginRequest): Promise<LoginResponse> {
        return apiClient.post('/auth/login', data);
    },

    /**
     * 회원가입
     */
    async register(data: RegisterRequest): Promise<RegisterResponse> {
        return apiClient.post('/auth/register', data);
    },

    /**
     * 로그아웃 (클라이언트 측)
     */
    logout(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            document.cookie = 'paca_auth=; path=/; max-age=0';
            window.location.href = '/login';
        }
    },

    /**
     * 현재 사용자 정보 가져오기
     */
    getCurrentUser() {
        if (typeof window === 'undefined') return null;
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch {
            return null;
        }
    },

    /**
     * 인증 여부 확인
     */
    isAuthenticated(): boolean {
        if (typeof window === 'undefined') return false;
        const token = localStorage.getItem('token');
        return !!token;
    },

    /**
     * 비밀번호 확인 (중요 작업 전 확인용)
     */
    async verifyPassword(password: string): Promise<{ message: string; verified: boolean }> {
        return apiClient.post('/auth/verify-password', { password });
    },
};
