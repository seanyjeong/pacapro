/**
 * 권한 체크 유틸리티
 */

import type { Permissions, PagePermission } from '@/lib/types/staff';

interface User {
  id: number;
  role: string;
  permissions?: Permissions;
}

/**
 * 현재 사용자 정보 가져오기
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 페이지 접근 권한 확인
 * @param pageKey - 페이지 키 (students, instructors, etc.)
 * @param action - 액션 (view, edit)
 * @returns boolean
 */
export function hasPermission(pageKey: string, action: 'view' | 'edit'): boolean {
  const user = getCurrentUser();
  if (!user) return false;

  // owner는 모든 권한
  if (user.role === 'owner') return true;

  // admin(시스템 관리자)도 모든 권한
  if (user.role === 'admin') return true;

  // staff는 permissions 체크
  if (user.role === 'staff') {
    const permissions = user.permissions || {};
    const pagePerm = permissions[pageKey as keyof Permissions] as PagePermission | undefined;
    return pagePerm?.[action] === true;
  }

  return false;
}

/**
 * 원장인지 확인
 */
export function isOwner(): boolean {
  const user = getCurrentUser();
  return user?.role === 'owner';
}

/**
 * 시스템 관리자인지 확인
 */
export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

/**
 * 직원인지 확인
 */
export function isStaff(): boolean {
  const user = getCurrentUser();
  return user?.role === 'staff';
}

/**
 * 페이지 보기 권한 확인
 */
export function canView(pageKey: string): boolean {
  return hasPermission(pageKey, 'view');
}

/**
 * 페이지 수정 권한 확인
 */
export function canEdit(pageKey: string): boolean {
  return hasPermission(pageKey, 'edit');
}

/**
 * React Hook: 권한 체크 (SSR 안전)
 * 사용 예: const { canEditPayments, canViewPayments } = usePermissions();
 */
export function usePermissions() {
  // SSR에서는 기본값 반환, 클라이언트에서만 실제 권한 체크
  if (typeof window === 'undefined') {
    return {
      user: null,
      isOwner: false,
      isAdmin: false,
      isStaff: false,
      canView: () => false,
      canEdit: () => false,
    };
  }

  const user = getCurrentUser();

  return {
    user,
    isOwner: user?.role === 'owner',
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    canView: (pageKey: string) => hasPermission(pageKey, 'view'),
    canEdit: (pageKey: string) => hasPermission(pageKey, 'edit'),
  };
}
