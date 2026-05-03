'use client';
// Phase 4 #3 (ADR-018) — 상태 변경 모달

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { ConsultationStatus } from '@/lib/types/consultation';

interface StatusChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newStatus: ConsultationStatus;
  onStatusChange: (status: ConsultationStatus) => void;
  adminNotes: string;
  onAdminNotesChange: (notes: string) => void;
  newDate: string;
  onDateChange: (date: string) => void;
  newTime: string;
  onTimeChange: (time: string) => void;
  editBookedTimes: string[];
  loadingEditBookedTimes: boolean;
  generateTimeSlots: (date: string) => string[];
  onLoadEditBookedTimes: (date: string) => void;
  onSave: () => void;
  updating: boolean;
}

export function StatusChangeModal({
  open,
  onOpenChange,
  newStatus,
  onStatusChange,
  adminNotes,
  onAdminNotesChange,
  newDate,
  onDateChange,
  newTime,
  onTimeChange,
  editBookedTimes,
  generateTimeSlots,
  onLoadEditBookedTimes,
  onSave,
  updating,
}: StatusChangeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md py-6 px-6">
        <DialogHeader>
          <DialogTitle>상태 변경</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>상태</Label>
            <Select value={newStatus} onValueChange={(v) => onStatusChange(v as ConsultationStatus)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
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
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="date"
                value={newDate}
                onChange={(e) => {
                  onDateChange(e.target.value);
                  if (e.target.value) onLoadEditBookedTimes(e.target.value);
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
            <Textarea
              value={adminNotes}
              onChange={(e) => onAdminNotesChange(e.target.value)}
              className="mt-1"
              rows={3}
            />
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
