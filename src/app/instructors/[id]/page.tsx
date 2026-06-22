'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { InstructorCard } from '@/components/instructors/instructor-card';
import { InstructorAttendanceComponent } from '@/components/instructors/instructor-attendance';
import { InstructorSalaries } from '@/components/instructors/instructor-salaries';
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
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/instructors')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 상세</h1>
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
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <header className="border-b border-border/70 pb-4">
          <Button size="sm" type="button" variant="outline" onClick={() => router.push('/instructors')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 상세</h1>
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
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <Button className="mb-2" size="sm" type="button" variant="outline" onClick={() => router.push('/instructors')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Instructor Profile</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">강사 상세</h1>
          <p className="text-sm text-muted-foreground">
            {instructor.name} 강사의 기본 정보, 출퇴근 기록, 급여 기록을 확인합니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
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
        </div>
      </header>

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
