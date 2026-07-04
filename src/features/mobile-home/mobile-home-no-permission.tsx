import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileHomeNoPermissionProps {
  academyName: string;
  loading: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  userName: string;
  userRoleLabel: string;
}

export function MobileHomeNoPermission({
  academyName,
  loading,
  onLogout,
  onRefresh,
  userName,
  userRoleLabel,
}: MobileHomeNoPermissionProps) {
  const titleName = userName ? `${userName}님` : '사용자님';

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50" data-testid="mobile-home-no-permission">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col justify-center gap-5">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{academyName || 'P-ACA'}</p>
              <h1 className="text-xl font-semibold leading-7">아직 사용할 수 있는 메뉴 권한이 없습니다</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {titleName} 계정은 로그인되어 있지만, 모바일에서 열 수 있는 권한이 아직 없습니다.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <p className="font-medium text-zinc-950 dark:text-zinc-50">{userRoleLabel}</p>
            <p className="mt-2">원장님에게 필요한 권한 부여를 요청해주세요.</p>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">수업스케줄, 학원비, 상담 권한 중 하나 이상이 켜지면 모바일 메뉴가 열립니다.</p>
          </div>

          <div className="mt-5 grid gap-3">
            <Button type="button" onClick={onRefresh} disabled={loading} className="h-12 w-full">
              <RefreshCw className={`mr-2 h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? '확인 중...' : '다시 확인'}
            </Button>
            <Button type="button" variant="outline" onClick={onLogout} className="h-12 w-full">
              <LogOut className="mr-2 h-5 w-5" />
              로그아웃
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
