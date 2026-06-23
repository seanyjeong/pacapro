import type { PendingUser } from '@/lib/api/users';
import { AlertCircle, Building2, Clock3, RefreshCw, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAdminUserDate } from './admin-users-utils';

interface AdminUsersOperationsBoardProps {
  users: PendingUser[];
  onRefresh: () => void;
}

export function AdminUsersOperationsBoard({ users, onRefresh }: AdminUsersOperationsBoardProps) {
  const ownerCount = users.filter((user) => user.role === 'owner').length;
  const instructorCount = users.filter((user) => user.role === 'instructor').length;
  const unassignedCount = users.filter((user) => !user.academy_name).length;
  const oldestUser = [...users].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  const academyCounts = getAcademyCounts(users);

  return (
    <aside
      aria-label="사용자 승인 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="admin-users-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">System Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">승인 작업 보드</h2>
        <p className="text-sm leading-6 text-slate-600">역할, 지점, 연락처를 확인한 뒤 계정 접근을 열어줍니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<Users className="h-4 w-4" />} label="승인 대기" value={`${users.length}명`} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="원장" value={`원장 ${ownerCount}명`} />
        <Metric icon={<UserCheck className="h-4 w-4" />} label="강사" value={`강사 ${instructorCount}명`} />
        <Metric icon={<AlertCircle className="h-4 w-4" />} label="학원 미지정" value={`${unassignedCount}명`} />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Clock3 className="h-4 w-4" />
          <span className="text-xs font-medium">가장 오래 대기</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-950">{oldestUser ? oldestUser.name : '대기 없음'}</p>
        <p className="mt-1 text-xs text-slate-600">{oldestUser ? formatAdminUserDate(oldestUser.created_at) : '신규 요청이 들어오면 표시됩니다.'}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">지점별 대기</p>
        {academyCounts.length > 0 ? (
          academyCounts.map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="font-semibold text-slate-950">{item.count}명</span>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">대기 중인 계정이 없습니다.</div>
        )}
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
        학원명과 역할이 맞지 않으면 거절하세요. 거절된 사용자는 가입 신청을 다시 해야 합니다.
      </div>

      <Button className="w-full justify-center gap-2" type="button" variant="outline" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" />
        목록 새로고침
      </Button>
    </aside>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
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
