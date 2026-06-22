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

interface ScheduleDeleteDialogProps {
  loading: boolean;
  open: boolean;
  scheduleName: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleDeleteDialog({
  loading,
  open,
  scheduleName,
  onConfirm,
  onOpenChange,
}: ScheduleDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>수업 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{scheduleName}</span> 수업을 삭제합니다. 삭제 후에는 목록과 캘린더에서 바로 사라집니다.
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
