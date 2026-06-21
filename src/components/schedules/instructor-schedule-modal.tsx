'use client';

/**
 * 강사 근무 배정 모달
 * - InstructorSchedulePanel을 Dialog로 감싸서 사용
 * - 태블릿/모바일에서 날짜 클릭 시 사용
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InstructorSchedulePanel } from './instructor-schedule-panel';

interface InstructorScheduleModalProps {
  open: boolean;
  date: string | null;
  onClose: () => void;
  onSave?: () => void;
}

export function InstructorScheduleModal({
  open,
  date,
  onClose,
  onSave,
}: InstructorScheduleModalProps) {
  const handleSave = () => {
    onSave?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <InstructorSchedulePanel
          date={date}
          onClose={onClose}
          onSave={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}
