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

export default function EditSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = parseInt(params.id as string);

  const { data: schedule, isLoading, error } = useSchedule(scheduleId);
  const updateSchedule = useUpdateSchedule();
  const [instructors, setInstructors] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    instructorsAPI.getInstructors({ status: 'active' }).then((res) => {
      setInstructors(res.instructors.map((i) => ({ id: i.id, name: i.name })));
    });
  }, []);

  const handleSubmit = async (data: ScheduleFormData) => {
    try {
      await updateSchedule.mutateAsync({ id: scheduleId, data });
      router.push(`/schedules/${scheduleId}`);
    } catch (error) {
      console.error('Failed to update schedule:', error);
    }
  };

  const handleCancel = () => {
    router.back();
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
        <h1 className="text-3xl font-bold">수업 수정</h1>
        <p className="text-muted-foreground mt-1">
          수업 정보를 수정하세요
        </p>
      </div>

      {/* 폼 */}
      <ScheduleForm
        schedule={schedule}
        instructors={instructors}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={updateSchedule.isPending}
      />
    </div>
  );
}
