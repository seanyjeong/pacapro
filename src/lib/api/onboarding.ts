/**
 * 온보딩 API 클라이언트
 */
import apiClient from './client';

export interface OnboardingStatus {
    onboarding_completed: boolean;
    onboarding_completed_at: string | null;
}

export interface OnboardingData {
    academy: {
        id: number;
        name: string;
        phone: string | null;
        address: string | null;
        business_number: string | null;
    };
    settings: {
        morning_class_time: string | null;
        afternoon_class_time: string | null;
        evening_class_time: string | null;
        tuition_due_day: number | null;
        salary_payment_day: number | null;
        salary_month_type: string | null;
        settings: string | null;
    };
}

export interface TuitionSettings {
    exam_tuition?: Record<string, number>;
    adult_tuition?: Record<string, number>;
}

export interface OnboardingCompletePayload {
    academy_name: string;
    phone?: string;
    address?: string;
    business_number?: string;
    morning_class_time: string;
    afternoon_class_time: string;
    evening_class_time: string;
    tuition_settings?: TuitionSettings;
    salary_payment_day: number;
    salary_month_type: 'current' | 'next';
    tuition_due_day: number;
}

export interface SampleDataResult {
    success: boolean;
    message: string;
    data: {
        students: { id: number; name: string }[];
        instructors: { id: number; name: string }[];
        seasons: { id: number; name: string }[];
    };
}

export const onboardingAPI = {
    /**
     * 온보딩 완료 여부 확인
     */
    getStatus: async (): Promise<OnboardingStatus> => {
        return await apiClient.get<OnboardingStatus>('/onboarding/status');
    },

    /**
     * 온보딩에 필요한 기존 데이터 조회
     */
    getData: async (): Promise<OnboardingData> => {
        return await apiClient.get<OnboardingData>('/onboarding/data');
    },

    /**
     * 온보딩 완료 처리
     */
    complete: async (payload: OnboardingCompletePayload): Promise<{ success: boolean; message: string }> => {
        return await apiClient.post<{ success: boolean; message: string }>('/onboarding/complete', payload);
    },

    /**
     * 샘플 데이터 생성
     */
    createSampleData: async (): Promise<SampleDataResult> => {
        return await apiClient.post<SampleDataResult>('/onboarding/sample-data');
    },

    /**
     * 온보딩 건너뛰기
     */
    skip: async (): Promise<{ success: boolean; message: string }> => {
        return await apiClient.post<{ success: boolean; message: string }>('/onboarding/skip');
    }
};
