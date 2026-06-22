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
import type { StudentFormConfirmState } from '../_types';

interface SubmitConfirmDialogProps {
  confirmState: StudentFormConfirmState | null;
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SubmitConfirmDialog({
  confirmState,
  open,
  submitting,
  onCancel,
  onConfirm,
}: SubmitConfirmDialogProps) {
  if (!confirmState) return null;

  const isImmediateClassDays = confirmState.type === 'immediate_class_days';
  const existingStudent = confirmState.existingStudent;
  const title = isImmediateClassDays ? '수업요일 즉시 변경' : '같은 이름 학생 확인';
  const confirmLabel = isImmediateClassDays ? '즉시 변경하고 저장' : '그래도 저장';

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !submitting) onCancel();
    }}>
      <AlertDialogContent className="max-w-md rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {isImmediateClassDays
              ? '저장하면 변경한 수업요일과 시간대가 이번 달 출석부에 바로 반영됩니다.'
              : '동명이인이 있을 수 있습니다. 기존 학생 정보를 확인한 뒤 계속 진행해 주세요.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isImmediateClassDays ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            다음 달부터 바꾸려면 취소 후 수업 정보의 적용 시작월을 선택하세요.
          </div>
        ) : null}

        {existingStudent ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">{existingStudent.name}</p>
            <p className="mt-1 text-muted-foreground">전화번호: {existingStudent.phone || '없음'}</p>
            {existingStudent.gender ? (
              <p className="mt-1 text-muted-foreground">
                성별: {existingStudent.gender === 'male' ? '남' : existingStudent.gender === 'female' ? '여' : existingStudent.gender}
              </p>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>취소</AlertDialogCancel>
          <Button type="button" disabled={submitting} onClick={onConfirm}>
            {submitting ? '저장 중...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
