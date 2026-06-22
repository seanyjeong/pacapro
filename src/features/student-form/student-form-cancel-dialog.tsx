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
import { LogOut } from 'lucide-react';

interface StudentFormCancelDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
}

const COPY = {
  create: {
    title: '등록 취소',
    description: '저장하지 않은 학생 등록 내용은 사라집니다. 학생 목록으로 돌아갈까요?',
  },
  edit: {
    title: '수정 취소',
    description: '저장하지 않은 학생 정보 변경 내용은 사라집니다. 학생 상세로 돌아갈까요?',
  },
} as const;

export function StudentFormCancelDialog({
  mode,
  open,
  onOpenChange,
  onLeave,
}: StudentFormCancelDialogProps) {
  const copy = COPY[mode];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>계속 작성</AlertDialogCancel>
          <Button variant="destructive" onClick={onLeave}>
            <LogOut className="mr-2 h-4 w-4" />
            나가기
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
