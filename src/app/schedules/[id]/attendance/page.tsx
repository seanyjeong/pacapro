'use client';

/**
 * 출석 체크 페이지
 */

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowLeft, Calendar, Clock, Loader2, RefreshCw, User } from 'lucide-react';
import { AttendanceChecker } from '@/components/schedules/attendance-checker';
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
      console.error('Failed to submit attendance');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 py-4 md:py-8">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Attendance Desk</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">출석 체크</h1>
        </header>
        <section className="flex min-h-[280px] items-center justify-center rounded-md border border-border bg-card p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </section>
      </div>
    );
  }

  if (scheduleError || attendanceError || !schedule) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 py-4 md:py-8">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Attendance Desk</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">출석 체크</h1>
        </header>
        <section className="flex min-h-[280px] items-center justify-center rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
          <div>
            <AlertCircle className="mx-auto h-9 w-9" />
            <h2 className="mt-4 text-base font-semibold">{ATTENDANCE_LOAD_ERROR}</h2>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => router.push('/schedules')}>
                목록으로
              </Button>
              <Button
                className="gap-2"
                onClick={() => {
                  refetchSchedule();
                  refetchAttendance();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                다시 불러오기
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 py-4 md:py-8">
      <header className="border-b border-border/70 pb-4">
        <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Attendance Desk</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">출석 체크</h1>
        <p className="mt-1 text-sm text-muted-foreground">학생 출석 상태와 보충 사유를 한 번에 정리합니다.</p>
      </header>

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
