import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileInstructorSlotSection } from './mobile-instructor-slot-section';
import type { MobileInstructor, MobileInstructorAttendanceStatus, MobileInstructorTimeSlot, SlotOption } from './mobile-instructor-types';

interface MobileInstructorListProps {
  attendances: Map<string, MobileInstructorAttendanceStatus>;
  clearedKeys: Set<string>;
  dateLabel: string;
  error: string | null;
  instructorsBySlot: Record<MobileInstructorTimeSlot, MobileInstructor[]>;
  loading: boolean;
  saving: boolean;
  slots: SlotOption[];
  totalInstructors: number;
  onAllPresent: (timeSlot: MobileInstructorTimeSlot) => void;
  onRetry: () => void;
  onStatusChange: (
    instructorId: number,
    timeSlot: MobileInstructorTimeSlot,
    status: MobileInstructorAttendanceStatus
  ) => void;
}

export function MobileInstructorList({
  attendances,
  clearedKeys,
  dateLabel,
  error,
  instructorsBySlot,
  loading,
  saving,
  slots,
  totalInstructors,
  onAllPresent,
  onRetry,
  onStatusChange,
}: MobileInstructorListProps) {
  if (loading) {
    return (
      <div className="space-y-3" data-testid="mobile-instructor-loading">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-36 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-3 w-full border-rose-200 bg-white dark:border-rose-800 dark:bg-zinc-950" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    );
  }

  if (totalInstructors === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <AlertCircle className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {dateLabel}에 배정된 강사가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {slots.map((slot) => (
        <MobileInstructorSlotSection
          key={slot.value}
          attendances={attendances}
          clearedKeys={clearedKeys}
          instructors={instructorsBySlot[slot.value]}
          label={slot.label}
          saving={saving}
          timeSlot={slot.value}
          onAllPresent={onAllPresent}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
