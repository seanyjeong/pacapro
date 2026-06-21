import apiClient from './client';
import type { AcademyEvent, AcademyEventFormData } from '../types/academyEvent';

interface AcademyEventsResponse {
    events: AcademyEvent[];
}

interface AcademyEventResponse {
    event: AcademyEvent;
    message?: string;
}

// 월별 학원 일정 조회
export async function getAcademyEvents(params: {
    start_date?: string;
    end_date?: string;
    event_type?: string;
}): Promise<AcademyEventsResponse> {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.event_type) searchParams.append('event_type', params.event_type);

    const query = searchParams.toString();
    return apiClient.get<AcademyEventsResponse>(`/academy-events${query ? `?${query}` : ''}`);
}

// 특정 일정 조회
export async function getAcademyEvent(id: number): Promise<AcademyEventResponse> {
    return apiClient.get<AcademyEventResponse>(`/academy-events/${id}`);
}

// 일정 생성
export async function createAcademyEvent(data: AcademyEventFormData): Promise<AcademyEventResponse> {
    return apiClient.post<AcademyEventResponse>('/academy-events', data);
}

// 일정 수정
export async function updateAcademyEvent(id: number, data: Partial<AcademyEventFormData>): Promise<AcademyEventResponse> {
    return apiClient.put<AcademyEventResponse>(`/academy-events/${id}`, data);
}

// 일정 삭제
export async function deleteAcademyEvent(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/academy-events/${id}`);
}
