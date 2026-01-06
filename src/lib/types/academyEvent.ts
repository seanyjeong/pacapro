export type AcademyEventType = 'work' | 'academy' | 'holiday' | 'etc';

export interface AcademyEvent {
    id: number;
    academy_id: number;
    title: string;
    description?: string;
    event_type: AcademyEventType;
    event_date: string; // YYYY-MM-DD
    start_time?: string; // HH:mm:ss
    end_time?: string; // HH:mm:ss
    is_all_day: boolean;
    is_holiday: boolean;
    color: string;
    created_by?: number;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
}

export interface AcademyEventFormData {
    title: string;
    description?: string;
    event_type: AcademyEventType;
    event_date: string;
    start_time?: string;
    end_time?: string;
    is_all_day: boolean;
    is_holiday: boolean;
    color?: string;
}

export const EVENT_TYPE_LABELS: Record<AcademyEventType, string> = {
    work: '업무일정',
    academy: '학원일정',
    holiday: '휴일',
    etc: '기타',
};

export const EVENT_TYPE_COLORS: Record<AcademyEventType, string> = {
    work: '#f59e0b',     // 황색
    academy: '#3b82f6',  // 청색
    holiday: '#ef4444',  // 적색
    etc: '#6b7280',      // 회색
};
