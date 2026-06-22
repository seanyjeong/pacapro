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
import type { Expense } from './expenses-types';

export type PendingExpenseAction = {
  id: number;
  type: 'delete' | 'refund';
};

interface ExpenseActionDialogProps {
  action: PendingExpenseAction | null;
  busy: boolean;
  expense: Expense | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExpenseActionDialog({
  action,
  busy,
  expense,
  onCancel,
  onConfirm,
}: ExpenseActionDialogProps) {
  const isDelete = action?.type === 'delete';
  const title = isDelete ? '지출 삭제' : '환불 완료 처리';
  const description = isDelete
    ? `${expense?.description || '선택한'} 지출 내역을 삭제할까요? 삭제 후에는 목록에서 확인할 수 없습니다.`
    : `${expense?.description || '선택한'} 환불 대기를 완료 처리할까요? 기본 지불 방법은 현금입니다.`;

  return (
    <AlertDialog open={Boolean(action)} onOpenChange={(open) => !busy && !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            className={isDelete ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {busy ? '처리 중' : isDelete ? '삭제' : '완료 처리'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
