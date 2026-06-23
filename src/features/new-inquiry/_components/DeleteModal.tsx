'use client';
// Phase 4 #3 (ADR-018) — 삭제 확인 모달

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  deleting: boolean;
}

export function DeleteModal({ open, onOpenChange, onDelete, deleting }: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm py-6 px-6">
        <DialogHeader>
          <DialogTitle>상담 삭제</DialogTitle>
          <DialogDescription>
            정말 이 상담을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button variant="destructive" onClick={onDelete} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
