import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BlockedSlotDialogProps {
  open: boolean;
  newBlockedDate: string;
  newBlockReason: string;
  addingBlock: boolean;
  onOpenChange: (open: boolean) => void;
  onDateChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onAdd: () => void;
}

export function BlockedSlotDialog({
  open,
  newBlockedDate,
  newBlockReason,
  addingBlock,
  onOpenChange,
  onDateChange,
  onReasonChange,
  onAdd,
}: BlockedSlotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>날짜 차단</DialogTitle>
          <DialogDescription>해당 날짜에는 상담 예약을 받지 않습니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-6">
          <div className="space-y-2">
            <Label>날짜</Label>
            <Input type="date" value={newBlockedDate} onChange={(event) => onDateChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>사유 (선택)</Label>
            <Input
              value={newBlockReason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="예: 공휴일, 학원 행사"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onAdd} disabled={addingBlock}>
            {addingBlock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
