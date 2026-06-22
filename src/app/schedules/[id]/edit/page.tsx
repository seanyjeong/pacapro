'use client';

/**
 * 수업 수정 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ScheduleForm } from '@/components/schedules/schedule-form';
import { SchedulePageHeader } from '@/features/schedules/schedule-page-header';
import { ScheduleErrorPanel, ScheduleLoadingPanel } from '@/features/schedules/schedule-page-states';
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
    } catch {
      setSubmitError(SCHEDULE_SAVE_ERROR);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
        <SchedulePageHeader
          description="수업 정보를 불러오는 중입니다."
          eyebrow="Schedule Editor"
          onBack={() => router.push('/schedules')}
          title="수업 수정"
        />
        <ScheduleLoadingPanel message="수업 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
        <SchedulePageHeader
          description="수업 정보를 다시 불러올 수 있습니다."
          eyebrow="Schedule Editor"
          onBack={() => router.push('/schedules')}
          title="수업 수정"
        />
        <ScheduleErrorPanel message={SCHEDULE_LOAD_ERROR} onRetry={() => refetch()} title="수업 정보를 불러오지 못했습니다" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
      <SchedulePageHeader
        description="수업 일정과 담당 강사 정보를 수정합니다."
        eyebrow="Schedule Editor"
        onBack={() => router.push('/schedules')}
        title="수업 수정"
      />

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
