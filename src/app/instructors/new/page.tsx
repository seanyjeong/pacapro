'use client';

import { useRouter } from 'next/navigation';
import { InstructorForm } from '@/components/instructors/instructor-form';
import { InstructorPageHeader } from '@/features/instructors/instructor-page-header';
import { instructorsAPI } from '@/lib/api/instructors';
import type { InstructorFormData } from '@/lib/types/instructor';

export default function NewInstructorPage() {
  const router = useRouter();

  const handleSubmit = async (data: InstructorFormData) => {
    await instructorsAPI.createInstructor(data, { suppressErrorToast: true });
    router.push('/instructors');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <InstructorPageHeader
        description="급여 방식과 근무 정보를 함께 등록합니다."
        eyebrow="Instructor Profile"
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
