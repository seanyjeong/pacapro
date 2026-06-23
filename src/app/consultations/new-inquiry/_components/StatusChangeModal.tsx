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
import Link from 'next/link';
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
  loadingEditBookedTimes,
  generateTimeSlots,
  onLoadEditBookedTimes,
  onSave,
  updating,
}: StatusChangeModalProps) {
  const timeSlots = newDate ? generateTimeSlots(newDate) : [];
  const hasNoTimeSlots = Boolean(newDate) && !loadingEditBookedTimes && timeSlots.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-md p-0">
        <DialogHeader className="px-5 py-4">
          <DialogTitle>상태 변경</DialogTitle>
          <p className="text-sm text-muted-foreground">상담 상태와 일정을 필요한 만큼만 수정합니다.</p>
        </DialogHeader>
        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="new-inquiry-status">상태</Label>
            <Select value={newStatus} onValueChange={(v) => onStatusChange(v as ConsultationStatus)}>
              <SelectTrigger id="new-inquiry-status">
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

          <div className="space-y-2">
            <Label>일정 변경</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="new-inquiry-edit-date">상담 날짜</Label>
                <Input
                  id="new-inquiry-edit-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => {
                    onDateChange(e.target.value);
                    if (e.target.value) onLoadEditBookedTimes(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="new-inquiry-edit-time">상담 시간</Label>
                {loadingEditBookedTimes ? (
                  <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">시간을 불러오는 중입니다.</div>
                ) : hasNoTimeSlots ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <p className="font-medium">상담 가능 시간이 설정되지 않았습니다.</p>
                    <Link className="mt-1 inline-flex text-xs font-semibold underline" href="/consultations/settings">
                      상담 설정으로 이동
                    </Link>
                  </div>
                ) : (
                  <Select value={newTime} onValueChange={onTimeChange}>
                    <SelectTrigger id="new-inquiry-edit-time">
                      <SelectValue placeholder="시간" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => {
                        const isBooked = editBookedTimes.includes(time);
                        return (
                          <SelectItem key={time} value={time} disabled={isBooked}>
                            {time} {isBooked && '(예약있음)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-inquiry-admin-notes">메모</Label>
            <Textarea
              id="new-inquiry-admin-notes"
              value={adminNotes}
              onChange={(e) => onAdminNotesChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSave} disabled={updating}>
            {updating ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
