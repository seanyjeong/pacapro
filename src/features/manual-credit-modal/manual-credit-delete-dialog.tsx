import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { ManualCredit } from './manual-credit-types';
import { CREDIT_TYPE_LABELS } from './manual-credit-utils';

interface ManualCreditDeleteDialogProps {
  busy: boolean;
  credit: ManualCredit | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ManualCreditDeleteDialog({
  busy,
  credit,
  onCancel,
  onConfirm,
}: ManualCreditDeleteDialogProps) {
  if (!credit) return null;

  const creditType = CREDIT_TYPE_LABELS[credit.credit_type] || credit.credit_type;

  return (
    <AlertDialog open={Boolean(credit)} onOpenChange={(open) => !open && !busy && onCancel()}>
      <AlertDialogContent className="max-w-md rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>크레딧 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            {creditType} 크레딧 {credit.credit_amount.toLocaleString()}원을 삭제합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          이미 적용된 크레딧은 삭제할 수 없습니다. 삭제 후에는 학생 납부 내역에서 다시 확인하세요.
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>닫기</AlertDialogCancel>
          <Button type="button" disabled={busy} variant="destructive" onClick={onConfirm}>
            {busy ? '삭제 중...' : '삭제'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
