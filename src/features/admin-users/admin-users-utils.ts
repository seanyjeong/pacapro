import type { PendingUser } from '@/lib/api/users';

export const LOAD_ERROR_MESSAGE = '사용자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export const ACTION_COPY = {
    approve: {
        title: '사용자 승인',
        description: '승인하면 해당 사용자는 바로 로그인해서 학원 업무 화면을 사용할 수 있습니다.',
        confirm: '승인',
        success: '사용자가 승인되었습니다.',
        error: '사용자 승인을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
    },
    reject: {
        title: '사용자 거절',
        description: '거절하면 해당 사용자는 현재 가입 요청으로 로그인할 수 없습니다.',
        confirm: '거절',
        success: '사용자가 거절되었습니다.',
        error: '사용자 거절을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
    },
} as const;

const ROLE_LABELS: Record<string, string> = {
    admin: '관리자',
    instructor: '강사',
    owner: '원장',
    staff: '직원',
};

export type PendingActionKind = keyof typeof ACTION_COPY;
export type PendingAction = { kind: PendingActionKind; user: PendingUser } | null;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function isSystemAdminUser(value: unknown): boolean {
    if (!isRecord(value)) return false;

    const role = typeof value.role === 'string' ? value.role : '';
    const academyId = Number(value.academyId ?? value.academy_id);
    return role === 'admin' || (role === 'owner' && academyId === 1);
}

export function getRoleLabel(role: string) {
    return ROLE_LABELS[role] ?? role;
}

export function getInitial(name: string) {
    return name.trim().charAt(0) || 'U';
}

export function formatAdminUserDate(dateStr: string) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
