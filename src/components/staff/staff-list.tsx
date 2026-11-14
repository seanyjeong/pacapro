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
      <section className="rounded-2xl bg-card p-5">
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-12 rounded-xl bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (staff.length === 0) {
    return (
      <section className="rounded-2xl bg-card p-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><User className="h-6 w-6" /></span>
        <h3 className="mt-3 text-[15px] font-semibold text-foreground">등록된 직원이 없어요</h3>
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
          <article key={member.id} className="space-y-4 rounded-2xl bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-bold text-foreground">{member.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                </div>
              </div>
              {member.is_active ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  활성
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                  <XCircle className="mr-1 h-3 w-3" />
                  비활성
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-muted p-3">
                <div className="text-muted-foreground">직급</div>
                <div className="mt-1 font-medium text-foreground">{member.position || '미지정'}</div>
              </div>
              <div className="rounded-xl bg-muted p-3">
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
                className="text-destructive hover:bg-destructive-soft hover:text-destructive"
              >
                삭제
              </Button>
            </div>
          </article>
        ))}
      </div>

      <section className="hidden overflow-hidden rounded-2xl bg-card md:block" data-testid="staff-desktop-list">
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-foreground">관리 계정 목록</h2>
            <p className="text-sm text-muted-foreground">계정, 직급, 권한 범위, 상태를 빠르게 확인합니다.</p>
          </div>
        </div>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full">
            <thead className="border-b border-border/60">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 text-left text-[13px] font-semibold text-muted-foreground">
                  직원 정보
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-[13px] font-semibold text-muted-foreground">
                  직급
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-[13px] font-semibold text-muted-foreground">
                  권한 요약
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-[13px] font-semibold text-muted-foreground">
                  상태
                </th>
                <th className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold text-muted-foreground">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {staff.map((member) => (
                <tr key={member.id} className="transition-colors hover:bg-muted/60">
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold text-foreground">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {member.position || '미지정'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <span className="text-sm text-muted-foreground">
                      {getPermissionSummary(member.permissions)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    {member.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                        <XCircle className="mr-1 h-3 w-3" />
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right text-sm font-medium">
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
                        className="text-destructive hover:text-destructive hover:bg-destructive-soft"
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
