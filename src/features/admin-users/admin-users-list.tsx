import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PendingUser } from '@/lib/api/users';
import { CheckCircle2, Loader2, Users, XCircle } from 'lucide-react';
import {
    formatAdminUserDate,
    getInitial,
    getRoleLabel,
    PendingAction,
    PendingActionKind,
} from './admin-users-utils';

interface AdminUsersListProps {
    actionLoading: number | null;
    pendingAction: PendingAction;
    users: PendingUser[];
    onOpenAction: (action: { kind: PendingActionKind; user: PendingUser }) => void;
}

export function AdminUsersList({ actionLoading, pendingAction, users, onOpenAction }: AdminUsersListProps) {
    if (users.length === 0) {
        return (
            <Card className="rounded-md border-border shadow-sm">
                <CardContent className="p-12 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Users className="h-7 w-7" />
                    </div>
                    <h2 className="mb-2 text-lg font-semibold text-foreground">승인 대기 중인 사용자가 없습니다</h2>
                    <p className="text-sm text-muted-foreground">새 회원가입 요청이 생기면 이 화면에서 바로 검토할 수 있습니다.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-md border-border shadow-sm">
            <CardHeader className="border-b border-border px-5 py-4">
                <CardTitle className="text-base font-semibold">승인 대기 목록</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div data-testid="admin-users-list" className="divide-y divide-border">
                    {users.map((user) => (
                        <AdminUsersListRow
                            key={user.id}
                            actionLoading={actionLoading}
                            pendingAction={pendingAction}
                            user={user}
                            onOpenAction={onOpenAction}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

interface AdminUsersListRowProps {
    actionLoading: number | null;
    pendingAction: PendingAction;
    user: PendingUser;
    onOpenAction: (action: { kind: PendingActionKind; user: PendingUser }) => void;
}

function AdminUsersListRow({ actionLoading, pendingAction, user, onOpenAction }: AdminUsersListRowProps) {
    const isRowLoading = actionLoading === user.id;

    return (
        <div className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/45 md:grid-cols-[minmax(0,1.15fr)_minmax(190px,0.95fr)_auto] md:items-center">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {getInitial(user.name)}
                </div>
                <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{user.name}</div>
                    <div className="truncate text-sm text-muted-foreground">{user.email}</div>
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2 md:grid-cols-1">
                <div className="truncate">
                    <span className="text-foreground">{user.academy_name || '학원 미지정'}</span>
                </div>
                <div className="truncate">{user.phone || '연락처 없음'}</div>
                <div className="break-keep leading-6">
                    {getRoleLabel(user.role)} · {formatAdminUserDate(user.created_at)}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button
                    size="sm"
                    onClick={() => onOpenAction({ kind: 'approve', user })}
                    disabled={actionLoading !== null}
                    aria-label={`${user.name} 승인`}
                    className="bg-green-600 hover:bg-green-700"
                >
                    {isRowLoading && pendingAction?.kind === 'approve' ? (
                        <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            처리 중
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            승인
                        </>
                    )}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenAction({ kind: 'reject', user })}
                    disabled={actionLoading !== null}
                    aria-label={`${user.name} 거절`}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                    {isRowLoading && pendingAction?.kind === 'reject' ? (
                        <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            처리 중
                        </>
                    ) : (
                        <>
                            <XCircle className="mr-1 h-4 w-4" />
                            거절
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
