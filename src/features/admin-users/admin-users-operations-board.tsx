import type { PendingUser } from '@/lib/api/users';
import { Building2, Clock3 } from 'lucide-react';
import { SectionCard } from '@/components/ui/page';
import { formatAdminUserDate } from './admin-users-utils';

interface AdminUsersOperationsBoardProps {
  users: PendingUser[];
}

// 가장 오래 기다린 요청과 학원별 대기. 숫자 요약은 위 칸에 있다.
export function AdminUsersOperationsBoard({ users }: AdminUsersOperationsBoardProps) {
  const oldestUser = [...users].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  const academyCounts = getAcademyCounts(users);

  return (
    <aside aria-label="사용자 승인 작업 보드" className="space-y-4" data-testid="admin-users-operations-board">
      <SectionCard title="가장 오래 대기">
        <div className="flex items-start gap-3 rounded-xl bg-muted p-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground">{oldestUser ? oldestUser.name : '대기 없음'}</p>
            <p className="mt-0.5 text-[13px] text-secondary-foreground">{oldestUser ? formatAdminUserDate(oldestUser.created_at) : '신규 요청이 들어오면 보여요.'}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="학원별 대기">
        {academyCounts.length > 0 ? (
          <div className="divide-y divide-border/60">
            {academyCounts.map((item) => (
              <div key={item.name} className="flex items-center justify-between py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-secondary-foreground">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-bold tabular-nums text-foreground">{item.count}명</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm text-secondary-foreground">대기 중인 계정이 없어요.</p>
        )}
      </SectionCard>

      <p className="rounded-2xl bg-primary-soft p-4 text-sm leading-6 text-primary">
        학원명·역할·연락처를 확인한 뒤 승인하세요. 맞지 않으면 거절하고, 거절된 사용자는 가입 신청을 다시 해야 해요.
      </p>
    </aside>
  );
}

function getAcademyCounts(users: PendingUser[]) {
  const counts = users.reduce<Record<string, number>>((acc, user) => {
    const name = user.academy_name || '학원 미지정';
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko-KR'))
    .slice(0, 4);
}
