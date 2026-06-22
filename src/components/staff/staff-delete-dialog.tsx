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
import type { Staff } from '@/lib/types/staff';

interface StaffDeleteDialogProps {
  loading: boolean;
  open: boolean;
  staff: Staff | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function StaffDeleteDialog({
  loading,
  open,
  staff,
  onConfirm,
  onOpenChange,
}: StaffDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>직원 계정 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{staff?.name || '선택한 직원'}</span> 계정을 삭제합니다.
            {' '}삭제하면 해당 직원은 더 이상 관리 화면에 로그인할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>취소</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                삭제 중
              </>
            ) : (
              '삭제'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
