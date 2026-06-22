'use client';

/**
 * 수업 등록 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ScheduleForm } from '@/components/schedules/schedule-form';
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
    } catch (error) {
      console.error('Failed to create schedule:', error);
      setSubmitError(SCHEDULE_SAVE_ERROR);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 py-4 md:py-8">
      <header className="border-b border-border/70 pb-4">
        <Button size="sm" type="button" variant="outline" onClick={() => router.push('/schedules')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Schedule Editor</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">수업 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">날짜, 시간대, 담당 강사를 지정해 수업 일정을 등록합니다.</p>
      </header>

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
