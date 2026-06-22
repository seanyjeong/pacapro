'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PendingUser } from '@/lib/api/users';
import { usersAPI } from '@/lib/api/users';
import { toast } from 'sonner';
import { AdminUsersActionDialog } from './admin-users-action-dialog';
import { AdminUsersList } from './admin-users-list';
import {
    AccessDeniedPanel,
    AdminUsersErrorPanel,
    AdminUsersHeader,
    AdminUsersLoadingPanel,
    AdminUsersSummary,
} from './admin-users-panels';
import { ACTION_COPY, isSystemAdminUser, LOAD_ERROR_MESSAGE, PendingAction } from './admin-users-utils';

export default function AdminUsersPage() {
    const router = useRouter();
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);

    const checkAccess = useCallback(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            setLoading(false);
            router.push('/login');
            return false;
        }

        try {
            if (isSystemAdminUser(JSON.parse(userStr))) {
                setAccessDenied(false);
                return true;
            }
        } catch (err) {
            console.warn('Failed to parse admin user access:', err);
        }

        setAccessDenied(true);
        setLoading(false);
        return false;
    }, [router]);

    const loadPendingUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await usersAPI.getPendingUsers();
            setPendingUsers(data.users);
        } catch (err: unknown) {
            console.warn('Failed to load pending users:', err);
            setError(LOAD_ERROR_MESSAGE);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (checkAccess()) {
            void loadPendingUsers();
        }
    }, [checkAccess, loadPendingUsers]);

    const confirmPendingAction = async () => {
        if (!pendingAction) return;

        const { kind, user } = pendingAction;
        const copy = ACTION_COPY[kind];

        try {
            setActionLoading(user.id);
            if (kind === 'approve') {
                await usersAPI.approveUser(user.id);
            } else {
                await usersAPI.rejectUser(user.id);
            }

            setPendingUsers((prev) => prev.filter((pendingUser) => pendingUser.id !== user.id));
            setIsActionDialogOpen(false);
            toast.success(copy.success);
        } catch (err: unknown) {
            console.warn(`Failed to ${kind} user:`, err);
            toast.error(copy.error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDialogOpenChange = (open: boolean) => {
        if (actionLoading !== null) return;
        setIsActionDialogOpen(open);
    };

    const openPendingAction = (action: Exclude<PendingAction, null>) => {
        setPendingAction(action);
        setIsActionDialogOpen(true);
    };

    if (accessDenied) {
        return <AccessDeniedPanel onGoDashboard={() => router.push('/')} />;
    }

    if (loading) {
        return <AdminUsersLoadingPanel />;
    }

    if (error) {
        return <AdminUsersErrorPanel error={error} onRetry={loadPendingUsers} />;
    }

    return (
        <div className="space-y-6">
            <AdminUsersHeader withRefresh onRefresh={loadPendingUsers} />
            <AdminUsersSummary pendingCount={pendingUsers.length} />
            <AdminUsersList
                actionLoading={actionLoading}
                pendingAction={pendingAction}
                users={pendingUsers}
                onOpenAction={openPendingAction}
            />
            <AdminUsersActionDialog
                action={pendingAction}
                loadingUserId={actionLoading}
                open={isActionDialogOpen}
                onConfirm={() => void confirmPendingAction()}
                onOpenChange={handleDialogOpenChange}
            />
        </div>
    );
}
