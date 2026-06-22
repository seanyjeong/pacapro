'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstructorForm } from '@/components/instructors/instructor-form';
import { instructorsAPI } from '@/lib/api/instructors';
import type { InstructorFormData } from '@/lib/types/instructor';

export default function NewInstructorPage() {
  const router = useRouter();

  const handleSubmit = async (data: InstructorFormData) => {
    try {
      await instructorsAPI.createInstructor(data, { suppressErrorToast: true });

      // 성공 시 목록 페이지로 이동
      router.push('/instructors');
    } catch (error) {
      console.error('Failed to create instructor:', error);
      throw error; // 폼에서 에러 처리하도록 전달
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="border-b border-border/70 pb-4">
        <Button size="sm" type="button" variant="outline" onClick={() => router.push('/instructors')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 등록</h1>
          <p className="mt-1 text-sm text-muted-foreground">급여 방식과 근무 정보를 함께 등록합니다.</p>
        </div>
      </header>

      <InstructorForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
