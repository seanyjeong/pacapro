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
import type { Student } from '@/lib/types/student';

export type TrialStudentAction = 'end_trial' | 'move_pending';

interface TrialStudentActionDialogProps {
  action: TrialStudentAction | null;
  busy: boolean;
  student: Student | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const ACTION_COPY: Record<TrialStudentAction, { title: string; description: string; confirm: string }> = {
  end_trial: {
    title: '체험 종료',
    description: '체험생 상태를 끝내고 미등록관리로 이동합니다.',
    confirm: '체험 종료',
  },
  move_pending: {
    title: '미등록관리 이동',
    description: '정식 등록 전 후속 상담이 필요한 학생으로 이동합니다.',
    confirm: '이동',
  },
};

export function TrialStudentActionDialog({
  action,
  busy,
  student,
  onCancel,
  onConfirm,
}: TrialStudentActionDialogProps) {
  if (!action || !student) return null;

  const copy = ACTION_COPY[action];

  return (
    <AlertDialog open={Boolean(action)} onOpenChange={(open) => !open && !busy && onCancel()}>
      <AlertDialogContent className="max-w-md rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {student.name} 학생을 미등록관리로 이동합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {copy.description} 기존 상담 기록과 메모는 유지됩니다.
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>닫기</AlertDialogCancel>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? '처리 중...' : copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
