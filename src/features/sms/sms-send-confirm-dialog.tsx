import { Loader2, Send } from 'lucide-react';
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
import type { SmsSendConfirmation } from './use-sms-page-state';

interface SmsSendConfirmDialogProps {
  confirmation: SmsSendConfirmation | null;
  open: boolean;
  sending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function SmsSendConfirmDialog({
  confirmation,
  open,
  sending,
  onConfirm,
  onOpenChange,
}: SmsSendConfirmDialogProps) {
  const imageCopy =
    confirmation && confirmation.imageCount > 0 ? `이미지 ${confirmation.imageCount}장 포함` : '이미지 없음';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {confirmation ? (
        <AlertDialogContent className="rounded-md sm:max-w-md">
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>문자 발송 확인</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation.recipientCount}명에게 {confirmation.messageType}를 발송합니다. 발송 후에는 되돌릴 수
                없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <dl className="grid grid-cols-2 gap-3 rounded-md border border-border/80 bg-muted/30 p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">수신 대상</dt>
                <dd className="mt-1 font-semibold text-foreground">{confirmation.recipientCount}명</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">문자 유형</dt>
                <dd className="mt-1 font-semibold text-foreground">{confirmation.messageType}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">첨부</dt>
                <dd className="mt-1 font-semibold text-foreground">{imageCopy}</dd>
              </div>
            </dl>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={sending}>취소</AlertDialogCancel>
              <AlertDialogAction
                disabled={sending}
                onClick={(event) => {
                  event.preventDefault();
                  onConfirm();
                }}
                className="gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? '발송 중' : '발송'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
