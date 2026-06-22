import { Bell, Plus, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SchedulePageHeader } from './schedule-page-header';

interface SchedulesHeaderProps {
  canViewOvertimeApproval: boolean;
  pendingCount: number;
  selectedDate: string | null;
  onAddSchedule: () => void;
  onOpenApprovals: () => void;
  onOpenInstructorAttendance: () => void;
}

export function SchedulesHeader({
  canViewOvertimeApproval,
  pendingCount,
  selectedDate,
  onAddSchedule,
  onOpenApprovals,
  onOpenInstructorAttendance,
}: SchedulesHeaderProps) {
  return (
    <SchedulePageHeader
      actions={
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {canViewOvertimeApproval && (
            <Button className="relative" variant="outline" onClick={onOpenApprovals}>
              <Bell className="mr-2 h-4 w-4" />
              승인 대기
              {pendingCount > 0 && (
                <Badge variant="destructive" className="absolute -right-2 -top-2 h-5 min-w-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={onOpenInstructorAttendance} disabled={!selectedDate}>
            <UserCheck className="mr-2 h-4 w-4" />
            강사 출근
          </Button>
          <Button onClick={onAddSchedule}>
            <Plus className="mr-2 h-4 w-4" />
            개별수업등록
          </Button>
        </div>
      }
      className="border-b-0 pb-0"
      description="수업 일정, 출석, 강사 근무 배정을 확인합니다."
      eyebrow="PACA Schedule Desk"
      title="수업 관리"
    />
  );
}
