import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ConsultationStatus } from '@/lib/types/consultation';

interface EnrolledConsultationStatusDialogProps {
  open: boolean;
  newStatus: ConsultationStatus;
  adminNotes: string;
  newDate: string;
  newTime: string;
  editBookedTimes: string[];
  updating: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: ConsultationStatus) => void;
  onAdminNotesChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onLoadBookedTimes: (date: string) => void;
  onSave: () => void;
  generateTimeSlots: (date: string) => string[];
}

export function EnrolledConsultationStatusDialog({
  open,
  newStatus,
  adminNotes,
  newDate,
  newTime,
  editBookedTimes,
  updating,
  onOpenChange,
  onStatusChange,
  onAdminNotesChange,
  onDateChange,
  onTimeChange,
  onLoadBookedTimes,
  onSave,
  generateTimeSlots,
}: EnrolledConsultationStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md px-6 py-6">
        <DialogHeader>
          <DialogTitle>상태 변경</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>상태</Label>
            <Select value={newStatus} onValueChange={(value) => onStatusChange(value as ConsultationStatus)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="대기중" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">대기중</SelectItem>
                <SelectItem value="confirmed">확정</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="cancelled">취소</SelectItem>
                <SelectItem value="no_show">노쇼</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>일정 변경 (선택)</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={newDate}
                onChange={(event) => {
                  onDateChange(event.target.value);
                  if (event.target.value) onLoadBookedTimes(event.target.value);
                }}
              />
              <Select value={newTime} onValueChange={onTimeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="시간" />
                </SelectTrigger>
                <SelectContent>
                  {generateTimeSlots(newDate).map((time) => {
                    const isBooked = editBookedTimes.includes(time);
                    return (
                      <SelectItem key={time} value={time}>
                        {time} {isBooked && '(예약있음)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>메모</Label>
            <Textarea value={adminNotes} onChange={(event) => onAdminNotesChange(event.target.value)} className="mt-1" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSave} disabled={updating}>
            {updating ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
