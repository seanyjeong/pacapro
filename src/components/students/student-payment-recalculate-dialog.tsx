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

interface StudentPaymentRecalculateDialogProps {
  busy: boolean;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function StudentPaymentRecalculateDialog({
  busy,
  open,
  onConfirm,
  onOpenChange,
}: StudentPaymentRecalculateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>첫 달 일할 재계산</AlertDialogTitle>
          <AlertDialogDescription>
            현재 학생 등록일과 수업 기준으로 첫 달 학원비를 다시 계산합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          미납 상태인 첫 달 청구만 다시 계산됩니다. 이미 납부된 청구는 유지됩니다.
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? '재계산 중...' : '재계산 실행'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
