'use client';

import { GraduationCap, Sparkles, Calendar, Target } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { MemoModalState } from '../_types';

interface MemoModalProps {
  memoModal: MemoModalState;
  onOpenChange: (open: boolean) => void;
}

export function MemoModal({ memoModal, onOpenChange }: MemoModalProps) {
  return (
    <Dialog open={memoModal.open} onOpenChange={(open) => onOpenChange(open)}>
      <DialogContent className="max-w-md py-6 px-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {memoModal.type === 'academic' && <GraduationCap className="h-5 w-5 text-blue-600" />}
            {memoModal.type === 'physical' && <Sparkles className="h-5 w-5 text-orange-600" />}
            {memoModal.type === 'general' && <Calendar className="h-5 w-5 text-green-600" />}
            {memoModal.type === 'target' && <Target className="h-5 w-5 text-purple-600" />}
            {memoModal.date} 상담 메모
          </DialogTitle>
          <DialogDescription>
            {memoModal.type === 'academic' ? '학업' :
             memoModal.type === 'physical' ? '실기' :
             memoModal.type === 'general' ? '종합' : '목표'} 메모
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{memoModal.content}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
