import type { LucideIcon } from 'lucide-react';

export interface InstructorBrief {
    id: number;
    name: string;
}

export interface InstructorSlotMap {
    morning: InstructorBrief[];
    afternoon: InstructorBrief[];
    evening: InstructorBrief[];
}

export interface DashboardPermissions {
    finance: boolean;
    unpaid: boolean;
    schedules: boolean;
    consultations: boolean;
}

export type DashboardTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface WorkQueueItem {
    id: string;
    title: string;
    detail: string;
    badge: string;
    tone: DashboardTone;
    icon: LucideIcon;
    href?: string;
    action?: () => void;
}
