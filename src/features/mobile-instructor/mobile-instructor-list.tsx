import { Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';
import { MobileErrorCard, MobileSkeleton } from '../mobile-home/mobile-screen';
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
    return <MobileSkeleton className="h-36" testId="mobile-instructor-loading" />;
  }

  if (error) {
    return <MobileErrorCard message={error} onRetry={onRetry} />;
  }

  if (totalInstructors === 0) {
    return (
      <div className="rounded-2xl bg-card">
        <EmptyState icon={Users} title={`${dateLabel}에 배정된 강사가 없어요`} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
