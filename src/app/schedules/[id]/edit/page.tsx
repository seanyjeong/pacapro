'use client';

/**
 * 수업 수정 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ScheduleForm } from '@/components/schedules/schedule-form';
import { useSchedule, useUpdateSchedule } from '@/hooks/use-schedules';
import { instructorsAPI } from '@/lib/api/instructors';
import type { ScheduleFormData } from '@/lib/types/schedule';

const INSTRUCTORS_LOAD_ERROR = '강사 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const SCHEDULE_LOAD_ERROR = '수업 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const SCHEDULE_SAVE_ERROR = '수업 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';

export default function EditSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const { data: schedule, isLoading, error, refetch } = useSchedule(scheduleId);
  const updateSchedule = useUpdateSchedule();
  const [instructors, setInstructors] = useState<{ id: number; name: string }[]>([]);
  const [instructorsError, setInstructorsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    instructorsAPI
      .getInstructors({ status: 'active' }, { suppressErrorToast: true })
      .then((res) => {
        setInstructors(res.instructors.map((i) => ({ id: i.id, name: i.name })));
        setInstructorsError(null);
      })
      .catch(() => {
        setInstructors([]);
        setInstructorsError(INSTRUCTORS_LOAD_ERROR);
      });
  }, []);

  const handleSubmit = async (data: ScheduleFormData) => {
    setSubmitError(null);
    try {
      await updateSchedule.mutateAsync({ id: scheduleId, data });
      router.push(`/schedules/${scheduleId}`);
    } catch (error) {
      console.error('Failed to update schedule:', error);
      setSubmitError(SCHEDULE_SAVE_ERROR);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Schedule Editor</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업 수정</h1>
        </header>
        <section className="flex min-h-[280px] items-center justify-center rounded-md border border-border bg-card p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </section>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Schedule Editor</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업 수정</h1>
        </header>
        <section className="flex min-h-[280px] items-center justify-center rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
          <div>
            <p className="text-base font-semibold">{SCHEDULE_LOAD_ERROR}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => router.push('/schedules')}>
                목록으로
              </Button>
              <Button onClick={() => refetch()}>다시 불러오기</Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
      <header className="border-b border-border/70 pb-4">
        <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Schedule Editor</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">수업 일정과 담당 강사 정보를 수정합니다.</p>
      </header>

      <ScheduleForm
        schedule={schedule}
        instructors={instructors}
        loadError={instructorsError}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={updateSchedule.isPending}
        submitError={submitError}
      />
    </div>
  );
}
