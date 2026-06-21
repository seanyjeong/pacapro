'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { staffApi } from '@/lib/api/staff';
import type { Staff, Permissions } from '@/lib/types/staff';
import { PERMISSION_CATEGORIES } from '@/lib/types/staff';
import { toast } from 'sonner';

interface PermissionModalProps {
  staff: Staff;
  onClose: () => void;
  onSubmit: () => void;
}

export function PermissionModal({ staff, onClose, onSubmit }: PermissionModalProps) {
  const [permissions, setPermissions] = useState<Permissions>({ ...staff.permissions });
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSION_CATEGORIES.map(cat => [cat.title, true]))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      await staffApi.updatePermissions(staff.id, permissions);
      toast.success('권한이 수정되었습니다.');
      onSubmit();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (pageKey: string, action: 'view' | 'edit', value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [pageKey]: {
        ...((prev as any)[pageKey] || { view: false, edit: false }),
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
        newPermissions[page.key as keyof Permissions] = {
          ...((prev as any)[page.key] || { view: false, edit: false }),
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
      const perm = (permissions as any)[page.key];
      return perm?.[action] === true;
    });
  };

  // 카테고리 내 일부 항목만 체크되어 있는지 확인 (indeterminate 상태)
  const isCategoryIndeterminate = (categoryTitle: string, action: 'view' | 'edit'): boolean => {
    const category = PERMISSION_CATEGORIES.find(cat => cat.title === categoryTitle);
    if (!category) return false;
    const checkedCount = category.items.filter((page) => {
      const perm = (permissions as any)[page.key];
      return perm?.[action] === true;
    }).length;
    return checkedCount > 0 && checkedCount < category.items.length;
  };

  const handleSelectAll = (action: 'view' | 'edit', value: boolean) => {
    const newPermissions: Permissions = {};
    PERMISSION_CATEGORIES.forEach((category) => {
      category.items.forEach((page) => {
        newPermissions[page.key as keyof Permissions] = {
          view: action === 'edit' && value ? true : (action === 'view' ? value : ((permissions as any)[page.key]?.view || false)),
          edit: action === 'edit' ? value : ((permissions as any)[page.key]?.edit || false),
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
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{staff.name} 권한 설정</CardTitle>
              <p className="text-sm text-muted-foreground">{staff.position || '직급 미지정'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 빠른 설정 */}
            <div className="flex gap-2 pb-4 border-b border-border">
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
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => toggleCategory(category.title)}
                          className="flex items-center gap-2 px-4 py-3 flex-1 text-left hover:bg-muted/80 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-sm">{category.title}</span>
                          <span className="text-xs text-muted-foreground">({category.items.length}개)</span>
                        </button>
                        <div className="flex items-center gap-6 px-4">
                          <label className="flex items-center gap-2 cursor-pointer">
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
                          <label className="flex items-center gap-2 cursor-pointer">
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
                            const perm = (permissions as any)[page.key] || { view: false, edit: false };
                            return (
                              <tr key={page.key} className="hover:bg-muted/50">
                                <td className="px-4 py-2.5 pl-10">
                                  <div className="text-sm font-medium text-foreground">{page.label}</div>
                                  <div className="text-xs text-muted-foreground">{page.description}</div>
                                </td>
                                <td className="px-4 py-2.5 text-center w-20">
                                  <input
                                    type="checkbox"
                                    checked={perm.view}
                                    onChange={(e) =>
                                      handlePermissionChange(page.key, 'view', e.target.checked)
                                    }
                                    className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center w-20">
                                  <input
                                    type="checkbox"
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

            {/* 버튼 */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
