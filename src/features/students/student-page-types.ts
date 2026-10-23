import type { LucideIcon } from 'lucide-react';
import type { StudentFilters } from '@/lib/types/student';

export type StudentTab = 'active' | 'paused' | 'withdrawn' | 'trial' | 'pending' | 'prospect' | 'graduated' | 'bySchool';

export interface StudentTabOption {
    id: StudentTab;
    label: string;
    description: string;
    icon: LucideIcon;
    toneClass: string;
}

export interface StudentListSort {
    key: string;
    dir: 'asc' | 'desc';
}

export interface StudentListState {
    tab: StudentTab;
    search: string;
    filters: StudentFilters;
    sort: StudentListSort | null;
}
