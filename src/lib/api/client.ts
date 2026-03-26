import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'sonner';

const PRIMARY_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/paca';
const FALLBACK_URL = process.env.NEXT_PUBLIC_FALLBACK_API_URL || 'https://supermax.kr/paca';

function createClient(baseURL: string) {
    return axios.create({
        baseURL,
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
    });
}

function isNetworkError(error: any): boolean {
    return !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
}

class APIClient {
    private primary: AxiosInstance;
    private fallback: AxiosInstance;
    private usingFallback: boolean = false;
    private lastPrimaryCheck: number = 0;

    constructor() {
        this.primary = createClient(PRIMARY_URL);
        this.fallback = createClient(FALLBACK_URL);

        // 토큰 자동 추가
        const addAuth = (config: any) => {
            const token = this.getToken();
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        };
        this.primary.interceptors.request.use(addAuth, (e) => Promise.reject(e));
        this.fallback.interceptors.request.use(addAuth, (e) => Promise.reject(e));

        // 에러 처리 (primary + fallback 공통)
        const handleError = (error: any) => {
            if (error.response?.status === 401) {
                this.clearAuth();
                if (typeof window !== 'undefined' &&
                    !window.location.pathname.startsWith('/login') &&
                    !window.location.pathname.startsWith('/register') &&
                    !window.location.pathname.startsWith('/forgot-password') &&
                    !window.location.pathname.startsWith('/reset-password')) {
                    window.location.href = '/login';
                }
            } else if (error.response?.status && typeof window !== 'undefined') {
                const msg = error.response?.data?.error || error.response?.data?.message;
                if (msg && error.response.status >= 400) {
                    toast.error(msg);
                }
            }
            return Promise.reject(error);
        };
        this.primary.interceptors.response.use((r) => r, handleError);
        this.fallback.interceptors.response.use((r) => r, handleError);
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

    private getClient(): AxiosInstance {
        // 5분마다 primary 재시도
        if (this.usingFallback && Date.now() - this.lastPrimaryCheck > 300000) {
            this.usingFallback = false;
        }
        return this.usingFallback ? this.fallback : this.primary;
    }

    private switchToFallback(): void {
        this.usingFallback = true;
        this.lastPrimaryCheck = Date.now();
        console.warn('[APIClient] Primary down, switching to fallback:', FALLBACK_URL);
    }

    async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        try {
            const res: AxiosResponse<T> = await this.getClient().get(url, config);
            return res.data;
        } catch (error: any) {
            if (!this.usingFallback && isNetworkError(error)) {
                this.switchToFallback();
                const res: AxiosResponse<T> = await this.fallback.get(url, config);
                return res.data;
            }
            throw error;
        }
    }

    async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        try {
            const res: AxiosResponse<T> = await this.getClient().post(url, data, config);
            return res.data;
        } catch (error: any) {
            if (!this.usingFallback && isNetworkError(error)) {
                this.switchToFallback();
                const res: AxiosResponse<T> = await this.fallback.post(url, data, config);
                return res.data;
            }
            throw error;
        }
    }

    async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        try {
            const res: AxiosResponse<T> = await this.getClient().put(url, data, config);
            return res.data;
        } catch (error: any) {
            if (!this.usingFallback && isNetworkError(error)) {
                this.switchToFallback();
                const res: AxiosResponse<T> = await this.fallback.put(url, data, config);
                return res.data;
            }
            throw error;
        }
    }

    async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        try {
            const res: AxiosResponse<T> = await this.getClient().delete(url, config);
            return res.data;
        } catch (error: any) {
            if (!this.usingFallback && isNetworkError(error)) {
                this.switchToFallback();
                const res: AxiosResponse<T> = await this.fallback.delete(url, config);
                return res.data;
            }
            throw error;
        }
    }

    async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        try {
            const res: AxiosResponse<T> = await this.getClient().patch(url, data, config);
            return res.data;
        } catch (error: any) {
            if (!this.usingFallback && isNetworkError(error)) {
                this.switchToFallback();
                const res: AxiosResponse<T> = await this.fallback.patch(url, data, config);
                return res.data;
            }
            throw error;
        }
    }
}

const apiClient = new APIClient();
export default apiClient;
