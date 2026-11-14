'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/ui/page';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InstructorCard } from '@/components/instructors/instructor-card';
import { InstructorAttendanceComponent } from '@/components/instructors/instructor-attendance';
import { InstructorSalaries } from '@/components/instructors/instructor-salaries';
import { InstructorPageHeader } from '@/features/instructors/instructor-page-header';
import { InstructorInitial, InstructorStatusBadge } from '@/features/instructors/instructor-badges';
import { INSTRUCTOR_TYPE_LABELS, SALARY_TYPE_LABELS } from '@/lib/types/instructor';
import { InstructorWorkCalendar } from '@/features/instructors/instructor-work-calendar';
import { InstructorErrorPanel, InstructorLoadingPanel } from '@/features/instructors/instructor-page-states';
import { useInstructor } from '@/hooks/use-instructors';
import { instructorsAPI } from '@/lib/api/instructors';

export default function InstructorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = Number(params.id);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { instructor, attendances, salaries, loading, error, reload } = useInstructor(instructorId);

  // 강사 수정 페이지로 이동
  const handleEdit = () => {
    router.push(`/instructors/${instructorId}/edit`);
  };

  // 강사 삭제
  const handleDelete = async () => {
    if (!instructor) return;

    try {
      setDeleting(true);
      await instructorsAPI.deleteInstructor(instructorId, { suppressErrorToast: true });
      toast.success('강사가 삭제되었습니다.');
      setDeleteDialogOpen(false);
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
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <InstructorPageHeader
          description="강사 정보를 불러오고 있어요."
          onBack={() => router.push('/instructors')}
          title="강사 상세"
        />
        <InstructorLoadingPanel message="강사 정보를 불러오고 있어요." />
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <InstructorPageHeader
          description="강사 상세 정보를 다시 불러올 수 있어요."
          onBack={() => router.push('/instructors')}
          title="강사 상세"
        />
        <InstructorErrorPanel message={error} onRetry={reload} title="강사 정보를 불러오지 못했습니다" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <Button className="-ml-2 text-muted-foreground" size="sm" type="button" variant="ghost" onClick={() => router.push('/instructors')}>
        <ArrowLeft className="h-4 w-4" />
        목록으로
      </Button>

      <section className="rounded-2xl bg-card p-5 sm:p-6" aria-label="강사 요약">
        <div className="flex items-start gap-4">
          <InstructorInitial instructor={instructor} className="h-16 w-16 text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-keep text-[26px] font-extrabold leading-tight tracking-tight text-foreground md:text-[28px]">{instructor.name}</h1>
              <InstructorStatusBadge status={instructor.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{SALARY_TYPE_LABELS[instructor.salary_type]}</Badge>
              {instructor.instructor_type ? <Badge variant="secondary">{INSTRUCTOR_TYPE_LABELS[instructor.instructor_type]}</Badge> : null}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button onClick={handleEdit}>
            <Edit className="h-4 w-4" />
            수정
          </Button>
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
          <Button className="col-span-2 text-destructive hover:text-destructive sm:col-span-1" variant="outline" onClick={() => setDeleteDialogOpen(true)} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="출퇴근 기록" value={`${attendances.length}건`} />
        <StatTile label="급여 기록" value={`${salaries.length}건`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="order-2 min-w-0 space-y-4 xl:order-1">
          <InstructorWorkCalendar instructorId={instructorId} />
          <InstructorAttendanceComponent attendances={attendances} loading={false} />
          <InstructorSalaries salaries={salaries} loading={false} />
        </div>
        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <InstructorCard instructor={instructor} />
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => !deleting && setDeleteDialogOpen(open)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>강사 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {instructor.name} 강사 기록을 삭제합니다. 삭제 후에는 강사 목록에서 보이지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
