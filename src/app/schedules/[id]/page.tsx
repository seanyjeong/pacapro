'use client';

/**
 * 수업 상세 페이지
 */

import { useRouter, useParams } from 'next/navigation';
import { ScheduleCard } from '@/components/schedules/schedule-card';
import { SchedulePageHeader } from '@/features/schedules/schedule-page-header';
import { ScheduleErrorPanel, ScheduleLoadingPanel } from '@/features/schedules/schedule-page-states';
import { useSchedule, useDeleteSchedule } from '@/hooks/use-schedules';

const SCHEDULE_LOAD_ERROR = '수업 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const { data: schedule, isLoading, error, refetch } = useSchedule(scheduleId);
  const deleteSchedule = useDeleteSchedule();

  const handleEdit = () => {
    router.push(`/schedules/${scheduleId}/edit`);
  };

  const handleDelete = async () => {
    if (!schedule) return;

    const scheduleName = schedule.title || `${schedule.instructor_name} 수업`;
    if (!confirm(`"${scheduleName}" 수업을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteSchedule.mutateAsync(scheduleId);
      router.push('/schedules');
    } catch {
      // Korean user-facing error is handled by the mutation toast.
    }
  };

  const handleAttendanceClick = () => {
    router.push(`/schedules/${scheduleId}/attendance`);
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5 py-4 md:py-8">
        <SchedulePageHeader
          description="수업 정보를 불러오는 중입니다."
          eyebrow="Schedule Detail"
          onBack={() => router.push('/schedules')}
          title="수업 상세"
        />
        <ScheduleLoadingPanel message="수업 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5 py-4 md:py-8">
        <SchedulePageHeader
          description="수업 정보를 다시 불러올 수 있습니다."
          eyebrow="Schedule Detail"
          onBack={() => router.push('/schedules')}
          title="수업 상세"
        />
        <ScheduleErrorPanel message={SCHEDULE_LOAD_ERROR} onRetry={() => refetch()} title="수업 정보를 불러오지 못했습니다" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 py-4 md:py-8">
      <SchedulePageHeader
        description="수업 정보와 출석 처리 상태를 확인합니다."
        eyebrow="Schedule Detail"
        onBack={() => router.push('/schedules')}
        title="수업 상세"
      />

      <ScheduleCard
        schedule={schedule}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAttendanceClick={handleAttendanceClick}
      />
    </div>
  );
}
