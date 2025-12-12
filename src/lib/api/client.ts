import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'sonner';

class APIClient {
    private client: AxiosInstance;
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://supermax.kr/paca';

        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request Interceptor: JWT 토큰 자동 추가
        this.client.interceptors.request.use(
            (config) => {
                const token = this.getToken();
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response Interceptor: 에러 처리
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    // 토큰 만료 또는 인증 실패 - 조용히 처리 (토스트 없음)
                    this.clearAuth();
                    if (typeof window !== 'undefined' &&
                        !window.location.pathname.startsWith('/login') &&
                        !window.location.pathname.startsWith('/register') &&
                        !window.location.pathname.startsWith('/forgot-password') &&
                        !window.location.pathname.startsWith('/reset-password')) {
                        window.location.href = '/login';
                    }
                    return Promise.reject(error); // 여기서 바로 리턴 (아래 에러 처리 안 함)
                } else if (error.response?.status === 403) {
                    // 권한 없음 - 사용자 친화적 메시지 표시
                    if (typeof window !== 'undefined') {
                        const message = error.response?.data?.message || '접근 권한이 없습니다.';
                        toast.error(message);
                    }
                } else if (error.response?.status === 500) {
                    // 서버 에러
                    if (typeof window !== 'undefined') {
                        const message = error.response?.data?.message || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
                        toast.error(message);
                    }
                } else if (error.response?.status === 404) {
                    // Not Found
                    if (typeof window !== 'undefined') {
                        const message = error.response?.data?.message || '요청한 데이터를 찾을 수 없습니다.';
                        toast.error(message);
                    }
                } else if (error.response?.status === 400) {
                    // Bad Request
                    if (typeof window !== 'undefined') {
                        const message = error.response?.data?.message || '잘못된 요청입니다.';
                        toast.error(message);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    private getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('token');
    }

    private clearAuth(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.get(url, config);
        return response.data;
    }

    async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.post(url, data, config);
        return response.data;
    }

    async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.put(url, data, config);
        return response.data;
    }

    async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.delete(url, config);
        return response.data;
    }

    async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.patch(url, data, config);
        return response.data;
    }
}

// Singleton instance
const apiClient = new APIClient();

export default apiClient;
