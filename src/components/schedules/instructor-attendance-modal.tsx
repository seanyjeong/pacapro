'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { InstructorAttendanceChecker } from './instructor-attendance-checker';

interface InstructorAttendanceModalProps {
  open: boolean;
  date: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InstructorAttendanceModal({
  open,
  date,
  onClose,
  onSuccess,
}: InstructorAttendanceModalProps) {
  if (!open || !date) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* Modal content */}
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
            <h2 className="text-[19px] font-bold tracking-tight text-foreground">강사 출근 체크</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Body */}
          <div className="max-h-[calc(92vh-72px)] overflow-y-auto bg-background p-3 sm:p-4">
            <InstructorAttendanceChecker date={date} onSuccess={onSuccess} />
          </div>
      </div>
    </div>
  );
}
