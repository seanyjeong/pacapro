'use client';

/**
 * 출석 체크 페이지
 */

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Calendar, Clock, User } from 'lucide-react';
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

export default function AttendancePage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const { data: schedule, isLoading: scheduleLoading } = useSchedule(scheduleId);
  const { data: attendances = [], isLoading: attendanceLoading, refetch: refetchAttendance } = useAttendance(scheduleId);
  const submitAttendance = useSubmitAttendance();

  const isLoading = scheduleLoading || attendanceLoading;

  const handleSubmit = async (submissions: AttendanceSubmission[]) => {
    try {
      await submitAttendance.mutateAsync({
        scheduleId,
        data: { attendance_records: submissions },
      });
      router.push(`/schedules/${scheduleId}`);
    } catch (error) {
      console.error('Failed to submit attendance:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">수업을 찾을 수 없습니다.</p>
          <Button onClick={() => router.push('/schedules')} className="mt-4">
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          돌아가기
        </Button>
        <h1 className="text-3xl font-bold">출석 체크</h1>
        <p className="text-muted-foreground mt-1">
          학생들의 출석을 체크하세요
        </p>
      </div>

      {/* 수업 정보 카드 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {schedule.title || `${schedule.instructor_name} 수업`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* 출석 체크 */}
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
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            이 수업의 출석은 이미 완료되었습니다. 수정이 필요한 경우 관리자에게 문의하세요.
          </p>
        </div>
      )}
    </div>
  );
}
