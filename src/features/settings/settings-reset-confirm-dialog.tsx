import { Loader2, Trash2 } from 'lucide-react';
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

interface SettingsResetConfirmDialogProps {
  isResetting: boolean;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

const RESET_TARGETS = ['학생 정보', '강사 정보', '학원비 내역', '급여 내역', '스케줄', '시즌 정보'];

export function SettingsResetConfirmDialog({
  isResetting,
  open,
  onConfirm,
  onOpenChange,
}: SettingsResetConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AlertDialogContent className="rounded-md sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>전체 데이터 초기화 확인</AlertDialogTitle>
            <AlertDialogDescription>
              학생, 강사, 수납, 급여, 스케줄, 시즌 정보를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">삭제되는 정보</p>
            <ul className="mt-2 space-y-1">
              {RESET_TARGETS.map((target) => (
                <li key={target}>- {target}</li>
              ))}
            </ul>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isResetting}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
              className="gap-2 bg-red-600 hover:bg-red-700"
            >
              {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isResetting ? '초기화 중' : '초기화'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
