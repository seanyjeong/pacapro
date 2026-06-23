'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarCheck2, CheckCircle2, ClipboardCheck, Send, UserCheck, Users } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ATTENDANCE_TEST_NOTIFICATION_HREF } from '@/lib/constants/notification-links';
import type { Consultation } from '@/lib/types/consultation';
import type { ClassSchedule } from '@/lib/types/schedule';
import { formatDateKorean } from '@/lib/utils/schedule-helpers';

interface SchedulesOperationsBoardProps {
  canViewOvertimeApproval: boolean;
  consultations: Record<string, Consultation[]>;
  pendingCount: number;
  schedules: ClassSchedule[];
  selectedDate: string | null;
  onOpenApprovals: () => void;
  onOpenExtraDay: () => void;
  onOpenInstructorAttendance: () => void;
}

export function SchedulesOperationsBoard({
  canViewOvertimeApproval,
  consultations,
  pendingCount,
  schedules,
  selectedDate,
  onOpenApprovals,
  onOpenExtraDay,
  onOpenInstructorAttendance,
}: SchedulesOperationsBoardProps) {
  const selectedSchedules = selectedDate
    ? schedules.filter((schedule) => schedule.class_date === selectedDate)
    : [];
  const selectedStudentCount = selectedSchedules.reduce((total, schedule) => total + (schedule.student_count || 0), 0);
  const selectedConsultationCount = selectedDate ? consultations[selectedDate]?.length || 0 : 0;
  const firstSchedule = selectedSchedules[0];

  return (
    <aside
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="schedules-operations-board"
      aria-label="수업 운영 보드"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Schedule Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">수업 운영 보드</h2>
        <p className="text-sm text-slate-600">
          {selectedDate ? formatDateKorean(selectedDate) : '날짜를 선택하면 출석과 강사 출근을 이어서 처리할 수 있습니다.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<CalendarCheck2 className="h-4 w-4" />} label="이번 달 수업" value={`${schedules.length}건`} />
        <Metric icon={<ClipboardCheck className="h-4 w-4" />} label="선택일 수업" value={`${selectedSchedules.length}건`} />
        <Metric icon={<Users className="h-4 w-4" />} label="선택일 학생" value={`${selectedStudentCount}명`} />
        <Metric icon={<UserCheck className="h-4 w-4" />} label="상담 일정" value={`${selectedConsultationCount}건`} />
        {canViewOvertimeApproval && (
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="승인 대기" value={`${pendingCount}건`} />
        )}
      </div>

      <div className="grid gap-2">
        <Link
          className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2' })}
          href="/schedules/new"
        >
          <CalendarCheck2 className="h-4 w-4" />
          수업 등록
        </Link>
        {firstSchedule ? (
          <Link
            className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2' })}
            href={`/schedules/${firstSchedule.id}/attendance`}
          >
            <ClipboardCheck className="h-4 w-4" />
            출석 체크
          </Link>
        ) : (
          <span className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2 opacity-50' })}>
            <ClipboardCheck className="h-4 w-4" />
            출석 체크
          </span>
        )}
        <Link
          className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2' })}
          href={ATTENDANCE_TEST_NOTIFICATION_HREF}
        >
          <Send className="h-4 w-4" />
          출결 테스트발송
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Button className="justify-start gap-2" disabled={!selectedDate} onClick={onOpenInstructorAttendance} variant="outline">
            <UserCheck className="h-4 w-4" />
            강사 출근
          </Button>
          <Button className="justify-start gap-2" disabled={!selectedDate} onClick={onOpenExtraDay} variant="outline">
            <CheckCircle2 className="h-4 w-4" />
            미배정 출근
          </Button>
        </div>
        {canViewOvertimeApproval && (
          <Button className="w-full justify-start gap-2" onClick={onOpenApprovals} variant="secondary">
            <CheckCircle2 className="h-4 w-4" />
            승인 대기 확인
          </Button>
        )}
      </div>
    </aside>
  );
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function Metric({ icon, label, value }: MetricProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
