'use client';

import { Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';

interface PendingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string | undefined;
  pendingMemo: string;
  setPendingMemo: (v: string) => void;
  convertingToPending: boolean;
  onConvert: () => void;
}

export function PendingModal({
  open, onOpenChange, studentName, pendingMemo, setPendingMemo,
  convertingToPending, onConvert
}: PendingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>미등록관리로 완료</DialogTitle>
          <DialogDescription>
            {studentName}님의 상담을 완료하고 미등록관리 학생으로 등록합니다.
            <br />
            나중에 체험 등록 또는 정식 등록할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-6 px-6">
          <div className="space-y-2">
            <Label>메모 (선택)</Label>
            <Textarea
              placeholder="추가 메모가 있으면 입력하세요..."
              value={pendingMemo}
              onChange={(e) => setPendingMemo(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onConvert} disabled={convertingToPending} className="bg-orange-600 hover:bg-orange-700">
            {convertingToPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Clock className="h-4 w-4 mr-2" />
            )}
            미등록관리로 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
