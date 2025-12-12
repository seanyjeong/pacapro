'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Shield } from 'lucide-react';
import { staffApi } from '@/lib/api/staff';
import type { Staff, Permissions } from '@/lib/types/staff';
import { PERMISSION_PAGES } from '@/lib/types/staff';
import { toast } from 'sonner';

interface PermissionModalProps {
  staff: Staff;
  onClose: () => void;
  onSubmit: () => void;
}

export function PermissionModal({ staff, onClose, onSubmit }: PermissionModalProps) {
  const [permissions, setPermissions] = useState<Permissions>({ ...staff.permissions });
  const [loading, setLoading] = useState(false);

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
      },
    }));
  };

  const handleSelectAll = (action: 'view' | 'edit', value: boolean) => {
    const newPermissions: Permissions = {};
    PERMISSION_PAGES.forEach((page) => {
      newPermissions[page.key as keyof Permissions] = {
        view: action === 'edit' && value ? true : (action === 'view' ? value : ((permissions as any)[page.key]?.view || false)),
        edit: action === 'edit' ? value : ((permissions as any)[page.key]?.edit || false),
      };
    });
    setPermissions(newPermissions);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border">
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

            {/* 권한 테이블 */}
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      페이지
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground w-20">
                      보기
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground w-20">
                      수정
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {PERMISSION_PAGES.map((page) => {
                    const perm = (permissions as any)[page.key] || { view: false, edit: false };
                    return (
                      <tr key={page.key} className="hover:bg-muted">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-foreground">{page.label}</div>
                          <div className="text-xs text-muted-foreground">{page.description}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm.view}
                            onChange={(e) =>
                              handlePermissionChange(page.key, 'view', e.target.checked)
                            }
                            className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
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
