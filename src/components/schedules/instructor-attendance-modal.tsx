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
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Modal content */}
      <div
        className="relative bg-card rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">강사 출근 체크</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Body */}
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
            <InstructorAttendanceChecker date={date} onSuccess={onSuccess} />
          </div>
      </div>
    </div>
  );
}
