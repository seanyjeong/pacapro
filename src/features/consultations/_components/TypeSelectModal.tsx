'use client';

import { GraduationCap, UserCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNew: () => void;
  onSelectLearning: () => void;
}

export function TypeSelectModal({ open, onOpenChange, onSelectNew, onSelectLearning }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>상담 유형 선택</DialogTitle>
          <DialogDescription>등록할 상담 유형을 선택하세요.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 px-6 py-6">
          <button
            onClick={() => { onOpenChange(false); onSelectNew(); }}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary-soft transition-all"
          >
            <div className="h-12 w-12 rounded-full bg-primary-soft flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <div className="font-semibold">신규 상담</div>
              <div className="text-xs text-muted-foreground">신규 학생 상담</div>
            </div>
          </button>
          <button
            onClick={() => { onOpenChange(false); onSelectLearning(); }}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-success hover:bg-success-soft transition-all"
          >
            <div className="h-12 w-12 rounded-full bg-success-soft flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-success" />
            </div>
            <div className="text-center">
              <div className="font-semibold">재원생 상담</div>
              <div className="text-xs text-muted-foreground">기존 학생 상담</div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
