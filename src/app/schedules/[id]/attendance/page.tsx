'use client';

/**
 * 출석 체크 페이지
 */

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User } from 'lucide-react';
import { AttendanceChecker } from '@/components/schedules/attendance-checker';
import { SchedulePageHeader } from '@/features/schedules/schedule-page-header';
import { ScheduleErrorPanel, ScheduleLoadingPanel } from '@/features/schedules/schedule-page-states';
import {
  useSchedule,
  useAttendance,
  useSubmitAttendance,
} from '@/hooks/use-schedules';
import type { AttendanceSubmission } from '@/lib/types/schedule';
import {
  formatDateKorean,
  getTimeSlotLabel,
  getTimeSlotColor,
} from '@/lib/utils/schedule-helpers';
import { cn } from '@/lib/utils';

const ATTENDANCE_LOAD_ERROR = '출석 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export default function AttendancePage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const {
    data: schedule,
    error: scheduleError,
    isLoading: scheduleLoading,
    refetch: refetchSchedule,
  } = useSchedule(scheduleId);
  const {
    data: attendances = [],
    error: attendanceError,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useAttendance(scheduleId);
  const submitAttendance = useSubmitAttendance();

  const isLoading = scheduleLoading || attendanceLoading;

  const handleSubmit = async (submissions: AttendanceSubmission[]) => {
    try {
      await submitAttendance.mutateAsync({
        scheduleId,
        data: { attendance_records: submissions },
      });
      router.push(`/schedules/${scheduleId}`);
    } catch {
      // Korean user-facing error is handled by the mutation toast.
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 py-4 md:py-8">
        <SchedulePageHeader
          description="수업 출석 정보를 불러오는 중입니다."
          eyebrow="Attendance Desk"
          onBack={() => router.push('/schedules')}
          title="출석 체크"
        />
        <ScheduleLoadingPanel message="출석 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (scheduleError || attendanceError || !schedule) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 py-4 md:py-8">
        <SchedulePageHeader
          description="출석 정보를 다시 불러올 수 있습니다."
          eyebrow="Attendance Desk"
          onBack={() => router.push('/schedules')}
          title="출석 체크"
        />
        <ScheduleErrorPanel
          message={ATTENDANCE_LOAD_ERROR}
          onRetry={() => {
            refetchSchedule();
            refetchAttendance();
          }}
          title="출석 정보를 불러오지 못했습니다"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 py-4 md:py-8">
      <SchedulePageHeader
        description="학생 출석 상태와 보충 사유를 한 번에 정리합니다."
        eyebrow="Attendance Desk"
        onBack={() => router.push('/schedules')}
        title="출석 체크"
      />

      <Card className="rounded-md">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base tracking-normal">
            {schedule.title || `${schedule.instructor_name} 수업`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">수업 날짜</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateKorean(schedule.class_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">시간대</p>
                <Badge
                  variant="outline"
                  className={cn('mt-1', getTimeSlotColor(schedule.time_slot))}
                >
                  {getTimeSlotLabel(schedule.time_slot)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">강사</p>
                <p className="text-sm text-muted-foreground">
                  {schedule.instructor_name || '강사'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AttendanceChecker
        attendances={attendances}
        onSubmit={handleSubmit}
        isSubmitting={submitAttendance.isPending}
        readOnly={schedule.attendance_taken}
        currentDate={schedule.class_date}
        scheduleId={scheduleId}
        timeSlot={schedule.time_slot}
        onStudentAdded={() => refetchAttendance()}
      />

      {schedule.attendance_taken && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            이 수업의 출석은 이미 완료되었습니다. 수정이 필요한 경우 관리자에게 문의하세요.
          </p>
        </div>
      )}
    </div>
  );
}
