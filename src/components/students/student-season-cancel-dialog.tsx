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
import type { StudentSeason } from '@/lib/types/season';

interface StudentSeasonCancelDialogProps {
  busy: boolean;
  enrollment: StudentSeason | null;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function StudentSeasonCancelDialog({
  busy,
  enrollment,
  open,
  onConfirm,
  onOpenChange,
}: StudentSeasonCancelDialogProps) {
  if (!enrollment) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>시즌 등록 취소</AlertDialogTitle>
          <AlertDialogDescription>
            {enrollment.season_name || '선택한 시즌'} 등록을 취소합니다. 미납 상태의 등록만 바로 취소됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          이미 납부된 시즌은 환불 처리 버튼을 사용해 환불 금액을 확인한 뒤 취소하세요.
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>닫기</AlertDialogCancel>
          <Button type="button" disabled={busy} variant="destructive" onClick={onConfirm}>
            {busy ? '취소 중...' : '등록 취소'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
