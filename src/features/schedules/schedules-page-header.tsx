import { Bell, Plus, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">수업 관리</h1>
        <p className="mt-1 text-sm text-slate-600">수업 일정, 출석, 강사 근무 배정을 확인합니다.</p>
      </div>
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
    </header>
  );
}
