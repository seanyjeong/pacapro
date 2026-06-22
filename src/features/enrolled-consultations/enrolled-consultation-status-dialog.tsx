import Link from 'next/link';
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
  loadingBookedTimes: boolean;
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
  loadingBookedTimes,
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
  const timeSlots = newDate ? generateTimeSlots(newDate) : [];
  const hasNoTimeSlots = Boolean(newDate) && !loadingBookedTimes && timeSlots.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-md px-6 py-6">
        <DialogHeader>
          <DialogTitle>상태 변경</DialogTitle>
          <p className="text-sm text-muted-foreground">상태와 상담 일정을 함께 조정합니다.</p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="enrolled-consultation-status">상태</Label>
            <Select value={newStatus} onValueChange={(value) => onStatusChange(value as ConsultationStatus)}>
              <SelectTrigger id="enrolled-consultation-status" className="mt-1">
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
            <Label htmlFor="enrolled-consultation-status-date">일정 변경 (선택)</Label>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                id="enrolled-consultation-status-date"
                type="date"
                value={newDate}
                onChange={(event) => {
                  onDateChange(event.target.value);
                  if (event.target.value) onLoadBookedTimes(event.target.value);
                }}
              />
              {loadingBookedTimes ? (
                <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">시간을 불러오는 중입니다.</div>
              ) : hasNoTimeSlots ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
                  <p className="font-medium">상담 가능 시간이 설정되지 않았습니다.</p>
                  <Link className="mt-1 inline-flex text-xs font-semibold underline" href="/consultations/settings">
                    상담 설정으로 이동
                  </Link>
                </div>
              ) : newDate ? (
                <Select value={newTime} onValueChange={onTimeChange}>
                  <SelectTrigger aria-label="상담 시간">
                    <SelectValue placeholder="시간" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => {
                      const isBooked = editBookedTimes.includes(time);
                      return (
                        <SelectItem key={time} value={time}>
                          {time} {isBooked && '(예약있음)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">날짜를 먼저 선택해주세요.</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="enrolled-consultation-status-notes">메모</Label>
            <Textarea
              id="enrolled-consultation-status-notes"
              value={adminNotes}
              onChange={(event) => onAdminNotesChange(event.target.value)}
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
