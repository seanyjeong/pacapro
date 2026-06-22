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

interface SalaryRecalculateDialogProps {
  busy: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SalaryRecalculateDialog({ busy, open, onCancel, onConfirm }: SalaryRecalculateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !busy && !nextOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>급여 재계산</AlertDialogTitle>
          <AlertDialogDescription>
            현재 단가와 출근 기록으로 급여를 다시 계산할까요? 저장된 기본급과 실수령액이 바뀔 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {busy ? '계산 중' : '재계산'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
