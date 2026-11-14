'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { InstructorForm } from '@/components/instructors/instructor-form';
import { InstructorPageHeader } from '@/features/instructors/instructor-page-header';
import { instructorsAPI } from '@/lib/api/instructors';
import type { InstructorFormData } from '@/lib/types/instructor';

export default function NewInstructorPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSubmit = async (data: InstructorFormData) => {
    await instructorsAPI.createInstructor(data, { suppressErrorToast: true });
    // 강사 목록은 캐시돼 있어 등록 직후 새 강사가 안 보였다(QA R01) — 목록을 다시 불러오게 한다.
    await queryClient.invalidateQueries({ queryKey: ['instructors'] });
    router.push('/instructors');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <InstructorPageHeader
        description="급여 방식과 근무 정보를 함께 등록합니다."
        onBack={() => router.push('/instructors')}
        title="강사 등록"
      />

      <InstructorForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
