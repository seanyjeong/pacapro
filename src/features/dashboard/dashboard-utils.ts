import { DashboardStats } from '@/lib/types';
import type { Consultation } from '@/lib/types/consultation';
import { formatCurrency } from '@/lib/utils/format';
import type { InstructorBrief, InstructorSlotMap } from './dashboard-types';

export const DASHBOARD_ERROR_MESSAGE = '대시보드 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
export const TODAY_DATA_ERROR_MESSAGE = '오늘 업무 일부를 불러오지 못했습니다. 새로고침해 주세요.';

export function getLocalDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getKoreanDateLabel(date = new Date()): string {
    const dateText = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const weekday = date.toLocaleDateString('ko-KR', { weekday: 'long' });
    return `${dateText} ${weekday}`;
}

export function hasInstructorSchedule(slots: InstructorSlotMap): boolean {
    return slots.morning.length > 0 || slots.afternoon.length > 0 || slots.evening.length > 0;
}

export function countInstructors(slots: InstructorSlotMap): number {
    const ids = new Set<number>();
    const groups: InstructorBrief[][] = [slots.morning, slots.afternoon, slots.evening];
    groups.forEach((slot) => slot.forEach((instructor) => ids.add(instructor.id)));
    return ids.size;
}

export function formatInstructorSlots(slots: InstructorSlotMap): string {
    const labels = [
        ['오전', slots.morning],
        ['오후', slots.afternoon],
        ['저녁', slots.evening],
    ] as const;

    const parts = labels
        .filter(([, instructors]) => instructors.length > 0)
        .map(([label, instructors]) => `${label} ${instructors.map((item) => item.name).join(', ')}`);

    return parts.length > 0 ? parts.join(' · ') : '등록된 강사 일정이 없습니다';
}

export function formatConsultationSummary(consultations: Consultation[]): string {
    if (consultations.length === 0) return '확정된 상담 일정이 없습니다';

    const names = consultations
        .slice(0, 3)
        .map((consultation) => `${consultation.preferred_time?.slice(0, 5) || '시간 미정'} ${consultation.student_name}`);

    const suffix = consultations.length > 3 ? ` 외 ${consultations.length - 3}건` : '';
    return `${consultations.length}건 · ${names.join(', ')}${suffix}`;
}

export function getNetIncomeLabel(stats: DashboardStats): string {
    const netIncome = stats.current_month.net_income;
    return netIncome >= 0 ? `흑자 ${formatCurrency(netIncome)}` : `적자 ${formatCurrency(Math.abs(netIncome))}`;
}

export function formatCompactCurrency(amount: number): string {
    const absolute = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';

    if (absolute >= 100000000) {
        const value = absolute / 100000000;
        return `${sign}${Number.isInteger(value) ? value : value.toFixed(1)}억원`;
    }

    if (absolute >= 10000) {
        return `${sign}${Math.round(absolute / 10000).toLocaleString()}만원`;
    }

    return `${sign}${absolute.toLocaleString()}원`;
}

export function toSafeNumber(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
