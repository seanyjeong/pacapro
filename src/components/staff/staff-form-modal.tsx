'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Eye, EyeOff } from 'lucide-react';
import { staffApi } from '@/lib/api/staff';
import type { Staff, AvailableInstructor, Permissions } from '@/lib/types/staff';
import { DEFAULT_PERMISSIONS, PERMISSION_PAGES } from '@/lib/types/staff';
import { toast } from 'sonner';

interface StaffFormModalProps {
  staff: Staff | null;
  availableInstructors: AvailableInstructor[];
  onClose: () => void;
  onSubmit: () => void;
}

export function StaffFormModal({
  staff,
  availableInstructors,
  onClose,
  onSubmit,
}: StaffFormModalProps) {
  const isEdit = !!staff;

  const [formData, setFormData] = useState({
    instructor_id: '',
    email: staff?.email || '',
    password: '',
    position: staff?.position || '',
    permissions: staff?.permissions || { ...DEFAULT_PERMISSIONS },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!isEdit && !formData.instructor_id) {
      newErrors.instructor_id = '강사를 선택해주세요.';
    }
    if (!formData.email) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.';
    }
    if (!isEdit && !formData.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);

      if (isEdit && staff) {
        await staffApi.updateStaff(staff.id, {
          position: formData.position || undefined,
          permissions: formData.permissions,
          password: formData.password || undefined,
        });
        toast.success('직원 정보가 수정되었습니다.');
      } else {
        await staffApi.createStaff({
          instructor_id: parseInt(formData.instructor_id),
          email: formData.email,
          password: formData.password,
          position: formData.position || undefined,
          permissions: formData.permissions,
        });
        toast.success('직원 계정이 생성되었습니다.');
      }

      onSubmit();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (pageKey: string, action: 'view' | 'edit', value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [pageKey]: {
          ...((prev.permissions as any)[pageKey] || { view: false, edit: false }),
          [action]: value,
          // edit를 true로 하면 view도 자동으로 true
          ...(action === 'edit' && value ? { view: true } : {}),
        },
      },
    }));
  };

  const handleSelectAll = (action: 'view' | 'edit', value: boolean) => {
    const newPermissions: Permissions = {};
    PERMISSION_PAGES.forEach((page) => {
      newPermissions[page.key as keyof Permissions] = {
        view: action === 'edit' && value ? true : (action === 'view' ? value : ((formData.permissions as any)[page.key]?.view || false)),
        edit: action === 'edit' ? value : ((formData.permissions as any)[page.key]?.edit || false),
      };
    });
    setFormData((prev) => ({ ...prev, permissions: newPermissions }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>{isEdit ? '직원 정보 수정' : '권한 부여'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {/* 강사 선택 (신규만) */}
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  강사 선택 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.instructor_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, instructor_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">강사를 선택하세요</option>
                  {availableInstructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name} ({instructor.phone})
                    </option>
                  ))}
                </select>
                {errors.instructor_id && (
                  <p className="mt-1 text-sm text-red-500">{errors.instructor_id}</p>
                )}
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                이메일 (로그인 ID) <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-muted"
                placeholder="example@email.com"
                disabled={isEdit}
                autoComplete="off"
                name="staff-email"
              />
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                비밀번호 {!isEdit && <span className="text-red-500">*</span>}
                {isEdit && <span className="text-muted-foreground text-xs">(변경시에만 입력)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-border bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="8자 이상"
                  autoComplete="new-password"
                  name="staff-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
            </div>

            {/* 직급 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">직급</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="부원장, 경리, 실장 등"
              />
            </div>

            {/* 권한 설정 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-foreground">페이지 권한</label>
                <div className="flex gap-2">
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
                      const perm = (formData.permissions as any)[page.key] || {
                        view: false,
                        edit: false,
                      };
                      return (
                        <tr key={page.key} className="hover:bg-muted">
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-foreground">{page.label}</div>
                            <div className="text-xs text-muted-foreground">{page.description}</div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={perm.view}
                              onChange={(e) =>
                                handlePermissionChange(page.key, 'view', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 border-border rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
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
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '저장 중...' : isEdit ? '수정' : '생성'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
