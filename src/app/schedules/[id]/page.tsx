'use client';

/**
 * 수업 상세 페이지
 */

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { ScheduleCard } from '@/components/schedules/schedule-card';
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
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleAttendanceClick = () => {
    router.push(`/schedules/${scheduleId}/attendance`);
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5 py-4 md:py-8">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Schedule Detail</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업 상세</h1>
        </header>
        <section className="flex min-h-[280px] items-center justify-center rounded-md border border-border bg-card p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </section>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5 py-4 md:py-8">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Schedule Detail</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업 상세</h1>
        </header>
        <section className="flex min-h-[280px] items-center justify-center rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
          <div>
            <AlertCircle className="mx-auto h-9 w-9" />
            <h2 className="mt-4 text-base font-semibold">{SCHEDULE_LOAD_ERROR}</h2>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => router.push('/schedules')}>
                목록으로
              </Button>
              <Button className="gap-2" onClick={() => refetch()}>
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
    <div className="mx-auto w-full max-w-4xl space-y-5 py-4 md:py-8">
      <header className="border-b border-border/70 pb-4">
        <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Schedule Detail</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업 상세</h1>
        <p className="mt-1 text-sm text-muted-foreground">수업 정보와 출석 처리 상태를 확인합니다.</p>
      </header>

      <ScheduleCard
        schedule={schedule}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAttendanceClick={handleAttendanceClick}
      />
    </div>
  );
}
