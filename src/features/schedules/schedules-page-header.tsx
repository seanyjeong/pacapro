import Link from 'next/link';
import { Bell, Plus, Send } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ATTENDANCE_TEST_NOTIFICATION_HREF } from '@/lib/constants/notification-links';
import { SchedulePageHeader } from './schedule-page-header';

interface SchedulesHeaderProps {
  canViewOvertimeApproval: boolean;
  pendingCount: number;
  onAddSchedule: () => void;
  onOpenApprovals: () => void;
}

export function SchedulesHeader({
  canViewOvertimeApproval,
  pendingCount,
  onAddSchedule,
  onOpenApprovals,
}: SchedulesHeaderProps) {
  return (
    <SchedulePageHeader
      actions={
        <>
          {canViewOvertimeApproval && (
            <Button variant="outline" onClick={onOpenApprovals}>
              <Bell className="h-4 w-4" />
              승인 대기
              {pendingCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground tabular-nums">
                  {pendingCount}
                </span>
              )}
            </Button>
          )}
          <Link className={buttonVariants({ variant: 'outline' })} href={ATTENDANCE_TEST_NOTIFICATION_HREF}>
            <Send className="h-4 w-4" />
            출결 테스트발송
          </Link>
          <Button onClick={onAddSchedule}>
            <Plus className="h-4 w-4" />
            개별수업등록
          </Button>
        </>
      }
      description="수업 일정, 출석, 강사 근무를 한곳에서 봐요."
      title="수업 관리"
    />
  );
}
