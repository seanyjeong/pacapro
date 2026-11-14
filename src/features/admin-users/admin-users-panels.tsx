import { Button } from '@/components/ui/button';
import { PageHeader, StatTile } from '@/components/ui/page';
import type { PendingUser } from '@/lib/api/users';
import { AlertCircle, RefreshCw, ShieldX } from 'lucide-react';

interface AccessDeniedPanelProps {
    onGoDashboard: () => void;
}

export function AccessDeniedPanel({ onGoDashboard }: AccessDeniedPanelProps) {
    return (
        <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
            <section className="w-full max-w-md rounded-2xl bg-card">
                <div className="p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive-soft text-destructive">
                        <ShieldX className="h-8 w-8" />
                    </div>
                    <h2 className="mb-2 text-[22px] font-extrabold text-foreground">접근 권한 없음</h2>
                    <p className="mb-6 text-sm leading-6 text-muted-foreground">
                        이 화면은 시스템 관리자만 사용할 수 있습니다.
                        <br />
                        필요한 경우 원장 계정으로 다시 로그인해주세요.
                    </p>
                    <Button onClick={onGoDashboard}>대시보드로 이동</Button>
                </div>
            </section>
        </div>
    );
}

export function AdminUsersHeader({ withRefresh, onRefresh }: { withRefresh?: boolean; onRefresh?: () => void }) {
    return (
        <PageHeader
            title="사용자 승인 관리"
            description="회원가입 승인 대기 중인 사용자를 검토해요."
            actions={withRefresh && onRefresh ? (
                <Button onClick={onRefresh} variant="outline" size="icon" title="새로고침" aria-label="새로고침">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            ) : undefined}
        />
    );
}

export function AdminUsersLoadingPanel() {
    return (
        <div className="space-y-4">
            <AdminUsersHeader />
            <section className="space-y-3 rounded-2xl bg-card p-5" aria-busy="true">
                {[0, 1, 2].map((item) => (
                    <div key={item} className="grid gap-3 rounded-xl bg-muted/60 p-4 md:grid-cols-[1.4fr_1fr_auto]">
                        <div className="h-12 animate-pulse rounded-lg bg-muted" />
                        <div className="h-12 animate-pulse rounded-lg bg-muted" />
                        <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
                    </div>
                ))}
            </section>
        </div>
    );
}

export function AdminUsersErrorPanel({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="space-y-4">
            <AdminUsersHeader />
            <section className="rounded-2xl bg-card p-8 text-center" role="alert">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="mb-2 text-[17px] font-bold text-foreground">사용자 목록을 불러오지 못했어요</h2>
                <p className="mb-5 text-sm text-muted-foreground">{error}</p>
                <Button onClick={onRetry}>다시 불러오기</Button>
            </section>
        </div>
    );
}

export function AdminUsersSummary({ users }: { users: PendingUser[] }) {
    const ownerCount = users.filter((user) => user.role === 'owner').length;
    const instructorCount = users.filter((user) => user.role === 'instructor').length;
    const unassignedCount = users.filter((user) => !user.academy_name).length;

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="승인 대기" value={`${users.length}명`} tone={users.length > 0 ? 'warning' : 'neutral'} />
            <StatTile label="원장" value={`${ownerCount}명`} />
            <StatTile label="강사" value={`${instructorCount}명`} />
            <StatTile label="학원 미지정" value={`${unassignedCount}명`} tone={unassignedCount > 0 ? 'danger' : 'neutral'} />
        </div>
    );
}
