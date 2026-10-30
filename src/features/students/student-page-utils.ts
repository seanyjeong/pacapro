import { Clock, GraduationCap, School, Sparkles, UserCheck, Users, UserX } from 'lucide-react';
import type { StudentFilters, StudentStatus } from '@/lib/types/student';
import {
    ADMISSION_TYPE_LABELS,
    ADMISSION_TYPE_OPTIONS,
    GENDER_LABELS,
    GENDER_OPTIONS,
    GRADE_LABELS,
    GRADE_OPTIONS,
    STUDENT_TYPE_LABELS,
    STUDENT_TYPE_OPTIONS,
} from '@/lib/types/student';
import type { StudentListSort, StudentListState, StudentTab, StudentTabOption } from './student-page-types';

export const STUDENT_TABS: StudentTabOption[] = [
    { id: 'active', label: '재원생', description: '수강 중', icon: UserCheck, toneClass: 'text-emerald-700 dark:text-emerald-300' },
    { id: 'paused', label: '휴원생', description: '복귀 관리', icon: Users, toneClass: 'text-amber-700 dark:text-amber-300' },
    { id: 'withdrawn', label: '퇴원생', description: '이력 확인', icon: UserX, toneClass: 'text-muted-foreground' },
    { id: 'graduated', label: '졸업생', description: '졸업 이력', icon: GraduationCap, toneClass: 'text-indigo-700 dark:text-indigo-300' },
    { id: 'trial', label: '체험생', description: '등록 전환', icon: Sparkles, toneClass: 'text-fuchsia-700 dark:text-fuchsia-300' },
    { id: 'pending', label: '미등록관리', description: '상담 후속', icon: Clock, toneClass: 'text-orange-700 dark:text-orange-300' },
    { id: 'prospect', label: '예비생', description: '엔진 등록', icon: Users, toneClass: 'text-sky-700 dark:text-sky-300' },
    { id: 'bySchool', label: '학교별', description: '학교 기준', icon: School, toneClass: 'text-sky-700 dark:text-sky-300' },
];

export function isStudentTab(value: string | null): value is StudentTab {
    return STUDENT_TABS.some((tab) => tab.id === value);
}

export function getStatusFromTab(tab: StudentTab): StudentStatus | undefined {
    if (tab === 'bySchool') return undefined;
    return tab as StudentStatus;
}

export function getFiltersForTab(tab: StudentTab): StudentFilters {
    return {
        status: getStatusFromTab(tab),
        is_trial: undefined,
    };
}

export function getActiveFilterLabels(filters: StudentFilters): string[] {
    const labels: string[] = [];

    if (filters.grade) labels.push(GRADE_LABELS[filters.grade]);
    if (filters.student_type) labels.push(STUDENT_TYPE_LABELS[filters.student_type]);
    if (filters.admission_type) labels.push(ADMISSION_TYPE_LABELS[filters.admission_type]);
    if (filters.gender) labels.push(GENDER_LABELS[filters.gender]);

    return labels;
}

export function shouldShowStudentFilters(tab: StudentTab): boolean {
    return tab !== 'trial';
}

// 목록 상태(탭·검색·필터·정렬)를 주소에 담아 학생 상세에서 돌아와도 그대로 보이게 한다.
const LIST_FILTER_OPTIONS = {
    student_type: STUDENT_TYPE_OPTIONS,
    grade: GRADE_OPTIONS,
    admission_type: ADMISSION_TYPE_OPTIONS,
    gender: GENDER_OPTIONS,
} as const;

type ListFilterKey = keyof typeof LIST_FILTER_OPTIONS;
const LIST_FILTER_KEYS = Object.keys(LIST_FILTER_OPTIONS) as ListFilterKey[];

export function readStudentListState(params: URLSearchParams): StudentListState {
    const tabParam = params.get('tab');
    const tab: StudentTab = isStudentTab(tabParam) ? tabParam : 'active';
    const search = params.get('q') || '';
    const filters: StudentFilters = getFiltersForTab(tab);
    LIST_FILTER_KEYS.forEach((key) => {
        const value = params.get(key);
        const options: ReadonlyArray<{ value: string }> = LIST_FILTER_OPTIONS[key];
        if (value && options.some((option) => option.value === value)) {
            Object.assign(filters, { [key]: value });
        }
    });
    if (search) filters.search = search;
    const sortKey = params.get('sort');
    const sort: StudentListSort | null = sortKey
        ? { key: sortKey, dir: params.get('dir') === 'desc' ? 'desc' : 'asc' }
        : null;
    return { tab, search, filters, sort };
}

export function buildStudentListQuery({ tab, search, filters, sort }: StudentListState): string {
    const params = new URLSearchParams();
    if (tab !== 'active') params.set('tab', tab);
    if (search) params.set('q', search);
    LIST_FILTER_KEYS.forEach((key) => {
        const value = filters[key];
        if (value) params.set(key, value);
    });
    if (sort) {
        params.set('sort', sort.key);
        params.set('dir', sort.dir);
    }
    return params.toString();
}

export function getNextSort(current: StudentListSort | null, key: string): StudentListSort {
    if (current?.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    return { key, dir: 'asc' };
}
