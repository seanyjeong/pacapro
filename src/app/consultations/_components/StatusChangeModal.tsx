'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { CONSULTATION_STATUS_LABELS } from '@/lib/types/consultation';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consultation: Consultation | null;
  newStatus: ConsultationStatus;
  setNewStatus: (s: ConsultationStatus) => void;
  adminNotes: string;
  setAdminNotes: (n: string) => void;
  newDate: string;
  newTime: string;
  setNewTime: (t: string) => void;
  editBookedTimes: string[];
  loadingEditBookedTimes: boolean;
  editTimeOptions: string[];
  handleEditDateChange: (date: string) => void;
  handleStatusChange: () => void;
  updating: boolean;
  onClose: () => void;
}

export function StatusChangeModal({
  open, onOpenChange, consultation,
  newStatus, setNewStatus, adminNotes, setAdminNotes,
  newDate, newTime, setNewTime,
  editBookedTimes, loadingEditBookedTimes, editTimeOptions,
  handleEditDateChange, handleStatusChange, updating, onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => {
      onOpenChange(o);
      if (!o) { onClose(); }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>상담 정보 변경</DialogTitle>
          <DialogDescription>
            {consultation?.student_name}님의 상담 상태/일정을 변경합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          {consultation && (
            <div className="bg-muted rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">현재 일정: </span>
              <span className="font-medium text-foreground">
                {consultation.preferred_date} {consultation.preferred_time.substring(0, 5)}
              </span>
            </div>
          )}

          <div>
            <Label>상태</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ConsultationStatus)}>
              <SelectTrigger>
                <SelectValue placeholder={CONSULTATION_STATUS_LABELS[newStatus]} />
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

          <div className="border-t border-border pt-4">
            <Label className="text-sm font-medium">일정 변경 (선택)</Label>
            <p className="text-xs text-muted-foreground mb-2">변경이 필요한 경우에만 선택하세요</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">날짜</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => handleEditDateChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              {newDate && (
                <div>
                  <Label className="text-xs">시간</Label>
                  {loadingEditBookedTimes ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />예약 현황 확인 중...
                    </div>
                  ) : editTimeOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {editTimeOptions.map((time) => {
                        const isBooked = editBookedTimes.includes(time);
                        const isSelected = newTime === time;
                        const isCurrent = consultation?.preferred_date === newDate &&
                          consultation?.preferred_time?.substring(0, 5) === time;
                        return (
                          <Button
                            key={time}
                            type="button"
                            size="sm"
                            variant={isSelected ? 'default' : isBooked ? 'secondary' : 'outline'}
                            onClick={() => setNewTime(time)}
                            className={`${isCurrent ? 'ring-2 ring-blue-300' : ''} ${isBooked ? 'border-orange-300 dark:border-orange-700' : ''}`}
                          >
                            {time}
                            {isBooked && <span className="ml-1 text-xs text-orange-600 dark:text-orange-400">●</span>}
                            {isCurrent && <span className="ml-1 text-xs">(현재)</span>}
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-orange-600 dark:text-orange-400 py-2">해당 요일은 휴무입니다</p>
                  )}
                  {editBookedTimes.length > 0 && editTimeOptions.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      * <span className="text-orange-600 dark:text-orange-400">●</span> 표시: 기존 상담 있음 (동시 상담 가능)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>관리자 메모</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="메모를 입력하세요..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleStatusChange} disabled={updating}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
