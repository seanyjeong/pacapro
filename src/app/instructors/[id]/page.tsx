'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Edit, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { InstructorCard } from '@/components/instructors/instructor-card';
import { InstructorAttendanceComponent } from '@/components/instructors/instructor-attendance';
import { InstructorSalaries } from '@/components/instructors/instructor-salaries';
import { InstructorPageHeader } from '@/features/instructors/instructor-page-header';
import { InstructorErrorPanel, InstructorLoadingPanel } from '@/features/instructors/instructor-page-states';
import { useInstructor } from '@/hooks/use-instructors';
import { instructorsAPI } from '@/lib/api/instructors';
import { useState } from 'react';

export default function InstructorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = Number(params.id);
  const [deleting, setDeleting] = useState(false);

  const { instructor, attendances, salaries, loading, error, reload } = useInstructor(instructorId);

  // 강사 수정 페이지로 이동
  const handleEdit = () => {
    router.push(`/instructors/${instructorId}/edit`);
  };

  // 강사 삭제
  const handleDelete = async () => {
    if (!instructor) return;

    const confirmed = window.confirm(
      `정말로 ${instructor.name} 강사를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      await instructorsAPI.deleteInstructor(instructorId, { suppressErrorToast: true });
      toast.success('강사가 삭제되었습니다.');
      router.push('/instructors');
    } catch (err) {
      console.error('Failed to delete instructor:', err);
      toast.error('강사 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <InstructorPageHeader
          description="강사 정보를 불러오는 중입니다."
          eyebrow="Instructor Profile"
          onBack={() => router.push('/instructors')}
          title="강사 상세"
        />
        <InstructorLoadingPanel message="강사 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <InstructorPageHeader
          description="강사 상세 정보를 다시 불러올 수 있습니다."
          eyebrow="Instructor Profile"
          onBack={() => router.push('/instructors')}
          title="강사 상세"
        />
        <InstructorErrorPanel message={error} onRetry={reload} title="강사 정보를 불러오지 못했습니다" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <InstructorPageHeader
        actions={
          <>
          <Button className="justify-center gap-2" variant="outline" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
          <Button className="justify-center gap-2" variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4" />
            수정
          </Button>
          <Button className="justify-center gap-2" variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
          </>
        }
        description={`${instructor.name} 강사의 기본 정보, 출퇴근 기록, 급여 기록을 확인합니다.`}
        eyebrow="Instructor Profile"
        onBack={() => router.push('/instructors')}
        title="강사 상세"
      />

      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">현재 강사</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{instructor.name}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
            <div className="rounded-md border border-border px-3 py-2">
              <span className="text-muted-foreground">출퇴근</span>
              <span className="ml-2 font-semibold text-foreground">{attendances.length}건</span>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <span className="text-muted-foreground">급여</span>
              <span className="ml-2 font-semibold text-foreground">{salaries.length}건</span>
            </div>
          </div>
        </div>
      </section>

      <InstructorCard instructor={instructor} />

      <InstructorAttendanceComponent attendances={attendances} loading={false} />

      <InstructorSalaries salaries={salaries} loading={false} />
    </div>
  );
}
