import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { ACTION_COPY, PendingAction } from './admin-users-utils';

interface AdminUsersActionDialogProps {
    action: PendingAction;
    loadingUserId: number | null;
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
}

export function AdminUsersActionDialog({
    action,
    loadingUserId,
    open,
    onConfirm,
    onOpenChange,
}: AdminUsersActionDialogProps) {
    const copy = action ? ACTION_COPY[action.kind] : null;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="rounded-md">
                {action && copy ? (
                    <>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
                            <AlertDialogDescription>
                                <span className="font-medium text-foreground">{action.user.name}</span> 계정을 {copy.confirm}합니다.{' '}
                                {copy.description}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={loadingUserId !== null}>취소</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={loadingUserId !== null}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onConfirm();
                                }}
                                className={action.kind === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                            >
                                {loadingUserId === action.user.id ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        처리 중
                                    </>
                                ) : (
                                    copy.confirm
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </>
                ) : null}
            </AlertDialogContent>
        </AlertDialog>
    );
}
