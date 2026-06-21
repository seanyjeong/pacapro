'use client';

/**
 * 수업 상세 페이지
 */

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ScheduleCard } from '@/components/schedules/schedule-card';
import { useSchedule, useDeleteSchedule } from '@/hooks/use-schedules';
import { toast } from 'sonner';

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const { data: schedule, isLoading, error } = useSchedule(scheduleId);
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
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleAttendanceClick = () => {
    router.push(`/schedules/${scheduleId}/attendance`);
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

  if (error || !schedule) {
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
    <div className="container mx-auto py-8 max-w-4xl">
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
        <h1 className="text-3xl font-bold">수업 상세</h1>
      </div>

      {/* 수업 카드 */}
      <ScheduleCard
        schedule={schedule}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAttendanceClick={handleAttendanceClick}
      />
    </div>
  );
}
