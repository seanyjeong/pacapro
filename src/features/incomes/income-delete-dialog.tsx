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
import type { OtherIncome } from './incomes-types';

interface IncomeDeleteDialogProps {
  busy: boolean;
  income: OtherIncome | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function IncomeDeleteDialog({ busy, income, onCancel, onConfirm }: IncomeDeleteDialogProps) {
  const description = `${income?.description || '선택한'} 수입 내역을 삭제할까요? 삭제 후에는 목록에서 확인할 수 없습니다.`;

  return (
    <AlertDialog open={Boolean(income)} onOpenChange={(open) => !busy && !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>기타 수입 삭제</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {busy ? '처리 중' : '삭제'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
