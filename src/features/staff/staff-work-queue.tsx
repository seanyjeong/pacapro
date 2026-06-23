'use client';

import { CheckCircle2, Shield, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AvailableInstructor, Staff } from '@/lib/types/staff';

interface Props {
  availableInstructors: AvailableInstructor[];
  staff: Staff[];
  onAddStaff: () => void;
}

export function StaffWorkQueue({ availableInstructors, staff, onAddStaff }: Props) {
  const activeCount = staff.filter((member) => member.is_active).length;
  const firstWaitingInstructor = availableInstructors[0];

  return (
    <aside className="space-y-4" data-testid="staff-work-queue">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Shield className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">관리 계정 운영 보드</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              권한 부여 대기 {availableInstructors.length}명, 활성 계정 {activeCount}명
            </p>
          </div>
        </div>

        {firstWaitingInstructor ? (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">{firstWaitingInstructor.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{firstWaitingInstructor.phone}</p>
            <Button size="sm" className="mt-3 w-full rounded-md" onClick={onAddStaff}>
              <UserPlus className="mr-2 h-4 w-4" />
              권한 부여 시작
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            권한을 부여할 수 있는 강사가 없습니다.
          </div>
        )}
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">권한 운영 원칙</h2>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          {['보기 권한 없이 수정 권한만 줄 수 없습니다.', '퇴사 또는 휴직 계정은 즉시 삭제합니다.', '원장 권한 작업 전 계정 소유자를 다시 확인합니다.'].map((text) => (
            <div key={text} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
