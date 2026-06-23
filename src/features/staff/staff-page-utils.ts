import type { AvailableInstructor, Staff } from '@/lib/types/staff';

export interface StaffSummary {
  activeCount: number;
  availableCount: number;
  inactiveCount: number;
  totalCount: number;
}

export function buildStaffSummary(staff: Staff[], availableInstructors: AvailableInstructor[]): StaffSummary {
  const activeCount = staff.filter((member) => member.is_active).length;
  return {
    activeCount,
    availableCount: availableInstructors.length,
    inactiveCount: staff.length - activeCount,
    totalCount: staff.length,
  };
}
