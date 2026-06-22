import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Clock, RefreshCw, ShieldX } from 'lucide-react';

interface AccessDeniedPanelProps {
    onGoDashboard: () => void;
}

export function AccessDeniedPanel({ onGoDashboard }: AccessDeniedPanelProps) {
    return (
        <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md rounded-md border-border shadow-sm">
                <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-red-50 text-red-600">
                        <ShieldX className="h-8 w-8" />
                    </div>
                    <h2 className="mb-2 text-2xl font-semibold text-foreground">접근 권한 없음</h2>
                    <p className="mb-6 text-sm leading-6 text-muted-foreground">
                        이 화면은 시스템 관리자만 사용할 수 있습니다.
                        <br />
                        필요한 경우 원장 계정으로 다시 로그인해주세요.
                    </p>
                    <Button onClick={onGoDashboard}>대시보드로 이동</Button>
                </CardContent>
            </Card>
        </div>
    );
}

export function AdminUsersHeader({ withRefresh, onRefresh }: { withRefresh?: boolean; onRefresh?: () => void }) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal text-foreground">사용자 승인 관리</h1>
                <p className="mt-1 text-sm text-muted-foreground">회원가입 승인 대기 중인 사용자를 검토합니다</p>
            </div>
            {withRefresh && onRefresh ? (
                <Button onClick={onRefresh} variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    새로고침
                </Button>
            ) : null}
        </div>
    );
}

export function AdminUsersLoadingPanel() {
    return (
        <div className="space-y-6">
            <AdminUsersHeader />
            <Card className="rounded-md border-border shadow-sm">
                <CardContent className="space-y-3 p-4">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1.4fr_1fr_auto]">
                            <div className="h-12 animate-pulse rounded-md bg-muted" />
                            <div className="h-12 animate-pulse rounded-md bg-muted" />
                            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

export function AdminUsersErrorPanel({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="space-y-6">
            <AdminUsersHeader />
            <Card className="rounded-md border-border shadow-sm">
                <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-red-50 text-red-600">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <h2 className="mb-2 text-lg font-semibold text-foreground">사용자 목록을 불러오지 못했습니다</h2>
                    <p className="mb-5 text-sm text-muted-foreground">{error}</p>
                    <Button onClick={onRetry}>다시 불러오기</Button>
                </CardContent>
            </Card>
        </div>
    );
}

export function AdminUsersSummary({ pendingCount }: { pendingCount: number }) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card className="rounded-md border-border shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-50 text-orange-600">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">승인 대기</div>
                        <div className="text-2xl font-semibold text-foreground">{pendingCount}명</div>
                    </div>
                </CardContent>
            </Card>
            <Card className="rounded-md border-border shadow-sm">
                <CardContent className="flex items-start gap-3 p-5">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">검토 기준</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            학원명, 역할, 연락처를 확인한 뒤 승인해주세요. 잘못 들어온 요청은 거절하면 다시 가입 신청이 필요합니다.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
