import type { Permissions } from '@/lib/types/staff';
import { PERMISSION_CATEGORIES } from '@/lib/types/staff';

/**
 * 모든 페이지의 보기 또는 수정 권한을 한 번에 켜거나 끈다.
 * 직전 권한(prev)을 받아 계산하므로 '전체 해제'처럼 보기·수정을 연달아 바꿔도 앞의 변경이 사라지지 않는다.
 */
export function selectAllPermissions(prev: Permissions, action: 'view' | 'edit', value: boolean): Permissions {
  const next: Permissions = {};
  PERMISSION_CATEGORIES.forEach((category) => {
    category.items.forEach((page) => {
      next[page.key] = {
        view: action === 'edit' && value ? true : (action === 'view' ? value : (prev[page.key]?.view || false)),
        edit: action === 'edit' ? value : (prev[page.key]?.edit || false),
      };
    });
  });
  return next;
}
