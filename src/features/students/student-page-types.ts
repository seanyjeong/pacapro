import type { LucideIcon } from 'lucide-react';

export type StudentTab = 'active' | 'paused' | 'withdrawn' | 'trial' | 'pending' | 'graduated' | 'bySchool';

export interface StudentTabOption {
    id: StudentTab;
    label: string;
    description: string;
    icon: LucideIcon;
    toneClass: string;
}
