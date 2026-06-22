'use client';

import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { InstructorForm } from '@/components/instructors/instructor-form';
import { useInstructor, useUpdateInstructor } from '@/hooks/use-instructors';
import type { InstructorFormData } from '@/lib/types/instructor';
import { Button } from '@/components/ui/button';

export default function EditInstructorPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = Number(params.id);

  const { instructor, loading, error, reload } = useInstructor(instructorId);
  const updateMutation = useUpdateInstructor();

  const handleSubmit = async (data: InstructorFormData) => {
    try {
      await updateMutation.mutateAsync({ id: instructorId, data });

      // 성공 시 상세 페이지로 이동 (toast는 훅 내부에서 표시됨)
      router.push(`/instructors/${instructorId}`);
    } catch (error) {
      console.error('Failed to update instructor:', error);
      throw error; // 폼에서 에러 처리하도록 전달
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/instructors')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 수정</h1>
            <p className="mt-1 text-sm text-muted-foreground">강사 정보를 불러오는 중입니다.</p>
          </div>
        </header>

        <section className="flex min-h-[320px] items-center justify-center rounded-md border border-border bg-card p-6 text-center">
          <div>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">강사 정보를 불러오는 중...</p>
          </div>
        </section>
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/instructors')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 수정</h1>
          </div>
        </header>

        <section className="flex min-h-[320px] items-center justify-center rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
          <div>
            <AlertCircle className="mx-auto h-9 w-9" />
            <h2 className="mt-4 text-base font-semibold">강사 정보를 불러오지 못했습니다</h2>
            <p className="mt-2 text-sm text-red-800 dark:text-red-200">잠시 후 다시 시도해 주세요.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => router.push('/instructors')}>
                목록으로
              </Button>
              <Button className="gap-2" onClick={reload}>
                <RefreshCw className="h-4 w-4" />
                다시 불러오기
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="border-b border-border/70 pb-4">
        <Button size="sm" type="button" variant="outline" onClick={() => router.push('/instructors')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 수정</h1>
          <p className="mt-1 text-sm text-muted-foreground">{instructor.name} 강사의 정보를 수정합니다.</p>
        </div>
      </header>

      <InstructorForm
        mode="edit"
        initialData={instructor}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
