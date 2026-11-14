'use client';

/**
 * 출석 체크 페이지
 */

import { useRouter, useParams } from 'next/navigation';
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
import { useAttendanceRealtime } from '@/hooks/use-attendance-realtime';
import type { AttendanceSubmission } from '@/lib/types/schedule';
import {
  formatDateKorean,
  getTimeSlotLabel,
} from '@/lib/utils/schedule-helpers';
import { TIME_SLOT_BADGE } from '@/features/schedules/time-slot-meta';

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

  useAttendanceRealtime({
    scheduleId,
    onAttendanceUpdated: () => {
      refetchSchedule();
      refetchAttendance();
    },
  });

  const isLoading = scheduleLoading || attendanceLoading;

  const handleSubmit = async (submissions: AttendanceSubmission[], mode?: 'class') => {
    try {
      await submitAttendance.mutateAsync({
        scheduleId,
        data: { attendance_records: submissions, mode },
      });
      router.push(`/schedules/${scheduleId}`);
    } catch {
      // Korean user-facing error is handled by the mutation toast.
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <SchedulePageHeader
          description="수업 출석 정보를 불러오는 중이에요."
          onBack={() => router.push('/schedules')}
          title="출석 체크"
        />
        <ScheduleLoadingPanel message="출석 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (scheduleError || attendanceError || !schedule) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <SchedulePageHeader
          description="출석 정보를 다시 불러올 수 있어요."
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
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <SchedulePageHeader
        description="학생 출석 상태와 보충 사유를 한 번에 정리해요."
        onBack={() => router.push('/schedules')}
        title="출석 체크"
      />

      <section className="rounded-2xl bg-card px-5 py-4 sm:px-6" aria-label="수업 정보">
        <p className="truncate text-[17px] font-bold text-foreground">
          {schedule.title || `${schedule.instructor_name} 수업`}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-secondary-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">수업 날짜</span>
            {formatDateKorean(schedule.class_date)}
          </span>
          <Badge variant={TIME_SLOT_BADGE[schedule.time_slot]} className="gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            <span className="sr-only">시간대</span>
            {getTimeSlotLabel(schedule.time_slot)}
          </Badge>
          <span className="inline-flex items-center gap-1.5">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">강사</span>
            {schedule.instructor_name || '강사'}
          </span>
        </div>
      </section>

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
        <div className="rounded-2xl bg-primary-soft p-4">
          <p className="text-sm font-medium text-primary">
            이 수업의 출석은 이미 끝났어요. 수정이 필요하면 관리자에게 문의해 주세요.
          </p>
        </div>
      )}
    </div>
  );
}
