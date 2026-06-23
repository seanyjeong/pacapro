'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { Consultation } from '@/lib/types/consultation';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consultation: Consultation | null;
  deleting: boolean;
  handleDelete: () => void;
}

export function DeleteModal({ open, onOpenChange, consultation, deleting, handleDelete }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>상담 신청 삭제</DialogTitle>
          <DialogDescription>
            {consultation?.student_name}님의 상담 신청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
