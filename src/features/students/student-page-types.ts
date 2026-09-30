import type { LucideIcon } from 'lucide-react';

export type StudentTab = 'active' | 'paused' | 'withdrawn' | 'trial' | 'pending' | 'prospect' | 'graduated' | 'bySchool';

export interface StudentTabOption {
    id: StudentTab;
    label: string;
    description: string;
    icon: LucideIcon;
    toneClass: string;
}
