'use client';

import { Button } from '@/components/ui/button';
import { Settings, Trash2, Edit, User, CheckCircle, XCircle } from 'lucide-react';
import type { Staff } from '@/lib/types/staff';
import { PERMISSION_PAGES } from '@/lib/types/staff';

interface StaffListProps {
  staff: Staff[];
  loading: boolean;
  onEditPermission: (staff: Staff) => void;
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
}

export function StaffList({ staff, loading, onEditPermission, onEdit, onDelete }: StaffListProps) {
  if (loading) {
    return (
      <section className="rounded-md border border-border bg-card p-4">
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-12 rounded-md bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (staff.length === 0) {
    return (
      <section className="rounded-md border border-border bg-card p-10 text-center">
        <User className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-3 text-lg font-semibold text-foreground">등록된 직원이 없습니다</h3>
        <p className="mt-1 text-sm text-muted-foreground">권한 부여 대기 강사를 선택해 관리 계정을 만드세요.</p>
      </section>
    );
  }

  const getPermissionSummary = (permissions: Staff['permissions']) => {
    const viewCount = PERMISSION_PAGES.filter(
      (page) => permissions[page.key as keyof typeof permissions]?.view
    ).length;
    const editCount = PERMISSION_PAGES.filter(
      (page) => permissions[page.key as keyof typeof permissions]?.edit
    ).length;

    return `보기: ${viewCount}개, 수정: ${editCount}개`;
  };

  return (
    <>
      <div className="space-y-3 md:hidden" data-testid="staff-mobile-list">
        {staff.map((member) => (
          <article key={member.id} className="space-y-4 rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{member.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                </div>
              </div>
              {member.is_active ? (
                <span className="inline-flex shrink-0 items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  활성
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" />
                  비활성
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-muted-foreground">직급</div>
                <div className="mt-1 font-medium text-foreground">{member.position || '미지정'}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-muted-foreground">권한 요약</div>
                <div className="mt-1 font-medium text-foreground">{getPermissionSummary(member.permissions)}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label={`${member.name} 권한 설정`}
                onClick={() => onEditPermission(member)}
              >
                권한
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={`${member.name} 정보 수정`}
                onClick={() => onEdit(member)}
              >
                수정
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={`${member.name} 삭제`}
                onClick={() => onDelete(member)}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                삭제
              </Button>
            </div>
          </article>
        ))}
      </div>

      <section className="hidden overflow-hidden rounded-md border border-border bg-card md:block" data-testid="staff-desktop-list">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">관리 계정 목록</h2>
            <p className="text-sm text-muted-foreground">계정, 직급, 권한 범위, 상태를 빠르게 확인합니다.</p>
          </div>
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{staff.length}명</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 border-b border-border bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  직원 정보
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  직급
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  권한 요약
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  상태
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {staff.map((member) => (
                <tr key={member.id} className="transition-colors hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {member.position || '미지정'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {getPermissionSummary(member.permissions)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {member.is_active ? (
                      <span className="inline-flex items-center rounded-md bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        <XCircle className="mr-1 h-3 w-3" />
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${member.name} 권한 설정`}
                        onClick={() => onEditPermission(member)}
                        title="권한 설정"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${member.name} 정보 수정`}
                        onClick={() => onEdit(member)}
                        title="정보 수정"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${member.name} 삭제`}
                        onClick={() => onDelete(member)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
