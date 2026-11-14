'use client';

import { CheckCircle2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/page';
import type { AvailableInstructor } from '@/lib/types/staff';

interface Props {
  availableInstructors: AvailableInstructor[];
  onAddStaff: () => void;
}

const RULES = ['보기 권한 없이 수정 권한만 줄 수 없습니다.', '퇴사 또는 휴직 계정은 즉시 삭제합니다.', '원장 권한 작업 전 계정 소유자를 다시 확인합니다.'];

// 권한 부여를 기다리는 첫 강사와 권한 운영 원칙(숫자는 위 요약에 있다).
export function StaffWorkQueue({ availableInstructors, onAddStaff }: Props) {
  const firstWaitingInstructor = availableInstructors[0];

  return (
    <aside className="space-y-4" data-testid="staff-work-queue">
      <SectionCard title="권한 부여 대기">
        {firstWaitingInstructor ? (
          <div className="rounded-xl bg-muted p-3">
            <p className="text-[15px] font-semibold text-foreground">{firstWaitingInstructor.name}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{firstWaitingInstructor.phone}</p>
            <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={onAddStaff}>
              <UserPlus className="h-4 w-4" />
              권한 부여 시작
            </Button>
          </div>
        ) : (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">권한을 부여할 수 있는 강사가 없어요.</p>
        )}
      </SectionCard>

      <SectionCard title="권한 운영 원칙">
        <div className="space-y-3 text-sm text-secondary-foreground">
          {RULES.map((text) => (
            <div key={text} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </aside>
  );
}
