import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import type {
    ConsultationTimelineItem,
    InitialConsultation,
    StudentConsultation,
} from './student-consultation-types';

export const CONSULTATION_TYPE_LABELS: Record<string, string> = {
    regular: '정기상담',
    admission: '진학상담',
    parent: '학부모상담',
    counseling: '고민상담',
};

export const INITIAL_STATUS_LABELS: Record<string, string> = {
    pending: '대기',
    confirmed: '확정',
    completed: '완료',
    cancelled: '취소',
    no_show: '노쇼',
};

export const MOCK_SCORE_SUBJECTS = [
    { key: 'korean', shortLabel: '국' },
    { key: 'math', shortLabel: '수' },
    { key: 'english', shortLabel: '영' },
    { key: 'exploration1', shortLabel: '탐1' },
    { key: 'exploration2', shortLabel: '탐2' },
];

export const INITIAL_GRADE_SUBJECTS = [
    { key: 'korean', label: '국어' },
    { key: 'math', label: '수학' },
    { key: 'english', label: '영어' },
    { key: 'exploration', label: '탐구' },
];

export function buildConsultationTimeline(
    consultations: StudentConsultation[],
    initialConsultations: InitialConsultation[]
): ConsultationTimelineItem[] {
    const studentItems: ConsultationTimelineItem[] = consultations.map((consultation) => ({
        type: 'student',
        data: consultation,
        date: consultation.consultation_date,
    }));
    const initialItems: ConsultationTimelineItem[] = initialConsultations.map((consultation) => ({
        type: 'initial',
        data: consultation,
        date: consultation.preferred_date,
    }));

    return [...studentItems, ...initialItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

export function formatKoreanDate(date: string): string {
    try {
        return format(parseISO(date), 'yyyy년 M월 d일 (EEE)', { locale: ko });
    } catch {
        return date;
    }
}

export function getMonthLabel(month: string): string {
    if (month === 'march') return '3월';
    if (month === 'june') return '6월';
    return '9월';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonRecord(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (isRecord(value)) return value;
    if (typeof value !== 'string') return null;

    try {
        const parsed: unknown = JSON.parse(value);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function parseJsonArray(value: unknown): unknown[] | null {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;

    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function formatUnknownValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
}

export function hasAnyValue(record: Record<string, unknown>): boolean {
    return Object.values(record).some((value) => Boolean(value));
}

export function getChecklistLabel(item: unknown): string {
    if (typeof item === 'string') return item;
    if (!isRecord(item)) return '';

    const text = item.text || item.label;
    return typeof text === 'string' ? text : '';
}

export function getChecklistInputValue(item: unknown): string {
    if (!isRecord(item) || !isRecord(item.input)) return '';
    return typeof item.input.value === 'string' ? item.input.value : '';
}

export function isChecklistChecked(item: unknown): boolean {
    return isRecord(item) && item.checked === true;
}
