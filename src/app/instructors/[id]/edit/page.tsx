'use client';

import { useParams, useRouter } from 'next/navigation';
import { InstructorForm } from '@/components/instructors/instructor-form';
import { InstructorPageHeader } from '@/features/instructors/instructor-page-header';
import { InstructorErrorPanel, InstructorLoadingPanel } from '@/features/instructors/instructor-page-states';
import { useInstructor, useUpdateInstructor } from '@/hooks/use-instructors';
import type { InstructorFormData } from '@/lib/types/instructor';

export default function EditInstructorPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = Number(params.id);

  const { instructor, loading, error, reload } = useInstructor(instructorId);
  const updateMutation = useUpdateInstructor();

  const handleSubmit = async (data: InstructorFormData) => {
    await updateMutation.mutateAsync({ id: instructorId, data });
    router.push(`/instructors/${instructorId}`);
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <InstructorPageHeader
          description="강사 정보를 불러오는 중입니다."
          eyebrow="Instructor Profile"
          onBack={() => router.push('/instructors')}
          title="강사 수정"
        />
        <InstructorLoadingPanel message="강사 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <InstructorPageHeader
          description="강사 정보를 다시 불러올 수 있습니다."
          eyebrow="Instructor Profile"
          onBack={() => router.push('/instructors')}
          title="강사 수정"
        />
        <InstructorErrorPanel message={error} onRetry={reload} title="강사 정보를 불러오지 못했습니다" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <InstructorPageHeader
        description={`${instructor.name} 강사의 정보를 수정합니다.`}
        eyebrow="Instructor Profile"
        onBack={() => router.push('/instructors')}
        title="강사 수정"
      />

      <InstructorForm
        mode="edit"
        initialData={instructor}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
