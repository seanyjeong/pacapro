'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { staffApi } from '@/lib/api/staff';
import type { PermissionKey, Permissions, Staff } from '@/lib/types/staff';
import { PERMISSION_CATEGORIES, PERMISSION_PAGES } from '@/lib/types/staff';
import { toast } from 'sonner';

interface PermissionModalProps {
  staff: Staff;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

function getPermissionCounts(permissions: Permissions) {
  return {
    edit: PERMISSION_PAGES.filter((page) => permissions[page.key]?.edit).length,
    view: PERMISSION_PAGES.filter((page) => permissions[page.key]?.view).length,
  };
}

function hasPermissionChanged(initial: Permissions, current: Permissions) {
  return PERMISSION_PAGES.some((page) => {
    const initialPermission = initial[page.key] || { view: false, edit: false };
    const currentPermission = current[page.key] || { view: false, edit: false };
    return initialPermission.view !== currentPermission.view || initialPermission.edit !== currentPermission.edit;
  });
}

export function PermissionModal({ staff, onClose, onSubmit }: PermissionModalProps) {
  const [permissions, setPermissions] = useState<Permissions>({ ...staff.permissions });
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSION_CATEGORIES.map(cat => [cat.title, true]))
  );
  const permissionCounts = getPermissionCounts(permissions);
  const permissionChanged = hasPermissionChanged(staff.permissions, permissions);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      await staffApi.updatePermissions(staff.id, permissions, { suppressErrorToast: true });
      toast.success('권한이 수정되었습니다.');
      await onSubmit();
    } catch {
      toast.error('권한을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (pageKey: PermissionKey, action: 'view' | 'edit', value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [pageKey]: {
        ...(prev[pageKey] || { view: false, edit: false }),
        [action]: value,
        // edit를 true로 하면 view도 자동으로 true
        ...(action === 'edit' && value ? { view: true } : {}),
        // view를 false로 하면 edit도 자동으로 false
        ...(action === 'view' && !value ? { edit: false } : {}),
      },
    }));
  };

  // 카테고리 전체 선택/해제
  const handleCategoryChange = (categoryTitle: string, action: 'view' | 'edit', value: boolean) => {
    const category = PERMISSION_CATEGORIES.find(cat => cat.title === categoryTitle);
    if (!category) return;

    setPermissions((prev) => {
      const newPermissions = { ...prev };
      category.items.forEach((page) => {
        newPermissions[page.key] = {
          ...(prev[page.key] || { view: false, edit: false }),
          [action]: value,
          // edit를 true로 하면 view도 자동으로 true
          ...(action === 'edit' && value ? { view: true } : {}),
          // view를 false로 하면 edit도 자동으로 false
          ...(action === 'view' && !value ? { edit: false } : {}),
        };
      });
      return newPermissions;
    });
  };

  // 카테고리 내 모든 항목이 체크되어 있는지 확인
  const isCategoryChecked = (categoryTitle: string, action: 'view' | 'edit'): boolean => {
    const category = PERMISSION_CATEGORIES.find(cat => cat.title === categoryTitle);
    if (!category) return false;
    return category.items.every((page) => {
      const perm = permissions[page.key];
      return perm?.[action] === true;
    });
  };

  // 카테고리 내 일부 항목만 체크되어 있는지 확인 (indeterminate 상태)
  const isCategoryIndeterminate = (categoryTitle: string, action: 'view' | 'edit'): boolean => {
    const category = PERMISSION_CATEGORIES.find(cat => cat.title === categoryTitle);
    if (!category) return false;
    const checkedCount = category.items.filter((page) => {
      const perm = permissions[page.key];
      return perm?.[action] === true;
    }).length;
    return checkedCount > 0 && checkedCount < category.items.length;
  };

  const handleSelectAll = (action: 'view' | 'edit', value: boolean) => {
    const newPermissions: Permissions = {};
    PERMISSION_CATEGORIES.forEach((category) => {
      category.items.forEach((page) => {
        newPermissions[page.key] = {
          view: action === 'edit' && value ? true : (action === 'view' ? value : (permissions[page.key]?.view || false)),
          edit: action === 'edit' ? value : (permissions[page.key]?.edit || false),
        };
      });
    });
    setPermissions(newPermissions);
  };

  const toggleCategory = (title: string) => {
    setExpandedCategories(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card className="flex h-[90vh] max-h-[760px] w-full max-w-3xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{staff.name} 권한 설정</CardTitle>
              <p className="text-sm text-muted-foreground">
                {staff.position || '직급 미지정'} · 보기 {permissionCounts.view}개 · 수정 {permissionCounts.edit}개
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="권한 설정 닫기">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-0">
          <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {/* 빠른 설정 */}
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">빠른 권한 설정</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      수정 권한을 켜면 보기 권한도 함께 적용됩니다.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAll('view', true)}
                    >
                      전체 보기
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAll('edit', true)}
                    >
                      전체 수정
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSelectAll('view', false);
                        handleSelectAll('edit', false);
                      }}
                    >
                      전체 해제
                    </Button>
                  </div>
                </div>
              </div>

              {/* 카테고리별 권한 테이블 */}
              <div className="space-y-3">
                {PERMISSION_CATEGORIES.map((category) => {
                  const isExpanded = expandedCategories[category.title];
                  const categoryViewChecked = isCategoryChecked(category.title, 'view');
                  const categoryEditChecked = isCategoryChecked(category.title, 'edit');
                  const categoryViewIndeterminate = isCategoryIndeterminate(category.title, 'view');
                  const categoryEditIndeterminate = isCategoryIndeterminate(category.title, 'edit');

                  return (
                    <div key={category.title} className="border border-border rounded-lg overflow-hidden">
                      {/* 카테고리 헤더 */}
                      <div className="bg-muted">
                        <div className="flex flex-col sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={() => toggleCategory(category.title)}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/80 sm:flex-1"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-sm">{category.title}</span>
                            <span className="text-xs text-muted-foreground">({category.items.length}개)</span>
                          </button>
                          <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:flex sm:items-center sm:gap-6 sm:pb-0">
                            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card/70 px-2 py-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                              <input
                                type="checkbox"
                                checked={categoryViewChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = categoryViewIndeterminate;
                                }}
                                onChange={(e) => handleCategoryChange(category.title, 'view', e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-muted-foreground">전체 보기</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card/70 px-2 py-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                              <input
                                type="checkbox"
                                checked={categoryEditChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = categoryEditIndeterminate;
                                }}
                                onChange={(e) => handleCategoryChange(category.title, 'edit', e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-muted-foreground">전체 수정</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* 서브메뉴 */}
                      {isExpanded && (
                        <table className="w-full">
                          <tbody className="divide-y divide-border bg-card">
                            {category.items.map((page) => {
                              const perm = permissions[page.key] || { view: false, edit: false };
                              return (
                                <tr key={page.key} className="hover:bg-muted/50">
                                  <td className="px-3 py-2.5 sm:px-4 sm:pl-10">
                                    <div className="text-sm font-medium text-foreground">{page.label}</div>
                                    <div className="text-xs text-muted-foreground">{page.description}</div>
                                  </td>
                                  <td className="w-14 px-2 py-2.5 text-center sm:w-20 sm:px-4">
                                    <input
                                      type="checkbox"
                                      aria-label={`${page.label} 보기 권한`}
                                      checked={perm.view}
                                      onChange={(e) =>
                                        handlePermissionChange(page.key, 'view', e.target.checked)
                                      }
                                      className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="w-14 px-2 py-2.5 text-center sm:w-20 sm:px-4">
                                    <input
                                      type="checkbox"
                                      aria-label={`${page.label} 수정 권한`}
                                      checked={perm.edit}
                                      onChange={(e) =>
                                        handlePermissionChange(page.key, 'edit', e.target.checked)
                                      }
                                      className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex flex-col gap-3 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {permissionChanged ? (
                  <span className="font-medium text-blue-700 dark:text-blue-300">저장하지 않은 변경사항이 있습니다.</span>
                ) : (
                  <span>저장된 권한과 동일합니다.</span>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  취소
                </Button>
                <Button type="submit" disabled={loading || !permissionChanged}>
                  {loading ? '저장 중...' : '권한 저장'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
