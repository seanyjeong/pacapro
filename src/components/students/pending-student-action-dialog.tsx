'use client';

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
import { Loader2, Trash2 } from 'lucide-react';

interface PendingStudentActionDialogProps {
  student: Student | null;
  open: boolean;
  loading: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
}

export function PendingStudentActionDialog({
  student,
  open,
  loading,
  errorMessage,
  onOpenChange,
  onConfirmDelete,
}: PendingStudentActionDialogProps) {
  const studentName = student?.name ?? '학생';

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            미등록 학생 삭제
          </AlertDialogTitle>
          <AlertDialogDescription>
            {studentName} 학생을 미등록관리에서 삭제합니다. 학생 정보와 연결된 기록이 함께 삭제되므로
            등록 가능성이 없는 학생인지 확인한 뒤 진행하세요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>닫기</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirmDelete} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            삭제
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
