'use client';

/**
 * 수업 등록 페이지
 */

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ScheduleForm } from '@/components/schedules/schedule-form';
import { useCreateSchedule } from '@/hooks/use-schedules';
import type { ScheduleFormData } from '@/lib/types/schedule';

export default function NewSchedulePage() {
  const router = useRouter();
  const createSchedule = useCreateSchedule();

  const handleSubmit = async (data: ScheduleFormData) => {
    try {
      const newSchedule = await createSchedule.mutateAsync(data);
      router.push(`/schedules/${newSchedule.id}`);
    } catch (error) {
      console.error('Failed to create schedule:', error);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
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
        <h1 className="text-3xl font-bold">수업 등록</h1>
        <p className="text-muted-foreground mt-1">
          새로운 수업 일정을 등록하세요
        </p>
      </div>

      {/* 폼 */}
      <ScheduleForm
        instructors={[
          // TODO: 실제 강사 목록으로 대체
          { id: 1, name: '김강사' },
          { id: 2, name: '이강사' },
          { id: 3, name: '박강사' },
        ]}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={createSchedule.isPending}
      />
    </div>
  );
}
