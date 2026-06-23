import { Loader2, Send, Trash2 } from 'lucide-react';
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
import type { NotificationPendingConfirmation } from '../_hooks/useNotificationSettings';

interface NotificationConfirmDialogProps {
  deletingSenderId: number | null;
  open: boolean;
  pending: NotificationPendingConfirmation | null;
  sendingUnpaid: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export default function NotificationConfirmDialog({
  deletingSenderId,
  open,
  pending,
  sendingUnpaid,
  onConfirm,
  onOpenChange,
}: NotificationConfirmDialogProps) {
  const isDeleting = pending?.kind === 'sender-delete' && deletingSenderId === pending.senderId;
  const isSending = pending?.kind === 'unpaid-send' && sendingUnpaid;
  const isBusy = isDeleting || isSending;
  const actionLabel = pending?.kind === 'sender-delete' ? '삭제' : '발송';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {pending ? (
        <AlertDialogContent className="rounded-md sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending.kind === 'sender-delete' ? '발신번호 삭제 확인' : '미납자 알림톡 발송 확인'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending.kind === 'sender-delete'
                ? `${pending.phone} 발신번호를 삭제합니다. 문자 발송 화면에서 이 번호를 더 이상 선택할 수 없습니다.`
                : `${pending.year}년 ${pending.month}월 미납자에게 알림톡을 발송합니다. 발송 후에는 되돌릴 수 없습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <dl className="rounded-md border border-border/80 bg-muted/30 p-4 text-sm">
            {pending.kind === 'sender-delete' ? (
              <div>
                <dt className="text-muted-foreground">삭제할 발신번호</dt>
                <dd className="mt-1 font-semibold text-foreground">{pending.phone}</dd>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted-foreground">발송 월</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {pending.year}년 {pending.month}월
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">대상</dt>
                  <dd className="mt-1 font-semibold text-foreground">미납자</dd>
                </div>
              </div>
            )}
          </dl>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBusy}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
              className={pending.kind === 'sender-delete' ? 'gap-2 bg-red-600 hover:bg-red-700' : 'gap-2'}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : pending.kind === 'sender-delete' ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isBusy ? '처리 중' : actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
