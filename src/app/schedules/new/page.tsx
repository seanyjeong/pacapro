'use client';

/**
 * 수업 등록 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScheduleForm } from '@/components/schedules/schedule-form';
import { SchedulePageHeader } from '@/features/schedules/schedule-page-header';
import { useCreateSchedule } from '@/hooks/use-schedules';
import { instructorsAPI } from '@/lib/api/instructors';
import type { ScheduleFormData } from '@/lib/types/schedule';

const INSTRUCTORS_LOAD_ERROR = '강사 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const SCHEDULE_SAVE_ERROR = '수업 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';

export default function NewSchedulePage() {
  const router = useRouter();
  const createSchedule = useCreateSchedule();
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
      const newSchedule = await createSchedule.mutateAsync(data);
      router.push(`/schedules/${newSchedule.id}`);
    } catch {
      setSubmitError(SCHEDULE_SAVE_ERROR);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
      <SchedulePageHeader
        description="날짜, 시간대, 담당 강사를 지정해 수업 일정을 등록합니다."
        eyebrow="Schedule Editor"
        onBack={() => router.push('/schedules')}
        title="수업 등록"
      />

      <ScheduleForm
        instructors={instructors}
        loadError={instructorsError}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={createSchedule.isPending}
        submitError={submitError}
      />
    </div>
  );
}
