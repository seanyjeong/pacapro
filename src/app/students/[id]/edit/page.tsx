'use client';

import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentForm } from '@/components/students/student-form';
import { StudentFormPageHeader } from '@/features/student-form/student-form-page-header';
import { useStudent } from '@/hooks/use-students';
import { studentsAPI } from '@/lib/api/students';
import type { StudentFormData } from '@/lib/types/student';

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = parseInt(params.id as string);
  const queryClient = useQueryClient();

  // useStudent 훅 사용
  const { student, loading, error, reload } = useStudent(studentId);

  const handleSubmit = async (data: StudentFormData) => {
    try {
      const response = await studentsAPI.updateStudent(studentId, data, { suppressErrorToast: true });

      // React Query 캐시 무효화 (상세 페이지 + 학생 목록 최신화)
      await queryClient.invalidateQueries({ queryKey: ['students', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['students'] });

      // 성공 알림
      toast.success(`${response.student.name} 학생 정보가 수정되었습니다!`);

      // 등록일 변경에 따른 첫 달 학원비 재계산 결과 알림
      if (response.enrollmentDateRecalc) {
        if (response.enrollmentDateRecalc.type === 'recalculated') {
          toast.info(response.enrollmentDateRecalc.message);
        } else {
          toast.warning(response.enrollmentDateRecalc.message);
        }
      }

      if (response.pendingInfo) {
        toast.info(response.pendingInfo.message);
      }

      // 상세 페이지로 이동
      router.push(`/students/${studentId}`);
    } catch (error: unknown) {
      console.warn('학생 정보 수정에 실패했습니다.');
      throw error; // StudentForm에서 에러 처리
    }
  };

  const handleCancel = () => {
    if (confirm('수정 중인 내용이 사라집니다. 취소하시겠습니까?')) {
      router.push(`/students/${studentId}`);
    }
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <StudentFormPageHeader
          backLabel="돌아가기"
          description="학생 정보를 불러오는 중입니다."
          eyebrow="Student Profile"
          title="학생 정보 수정"
          onBack={() => router.push(`/students/${studentId}`)}
        />
        <section className="rounded-md border border-border bg-card p-5" aria-busy="true">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-md border border-border/70 p-4">
                <div className="h-3 w-20 rounded-md bg-muted" />
                <div className="mt-3 h-9 rounded-md bg-muted" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // 에러 화면
  if (error || !student) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <StudentFormPageHeader
          description="학생 정보를 다시 불러올 수 있습니다."
          eyebrow="Student Profile"
          title="학생 정보 수정"
          onBack={() => router.push('/students')}
        />
        <section
          className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">학생 정보를 불러올 수 없습니다</h2>
                <p className="text-sm">{error || '학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}</p>
              </div>
            </div>
            <Button className="gap-2" size="sm" type="button" variant="outline" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
              다시 불러오기
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <StudentFormPageHeader
        backLabel="돌아가기"
        description={`${student.name} 학생의 정보, 수업 요일, 학원비 기준을 수정합니다.`}
        eyebrow="Student Profile"
        title="학생 정보 수정"
        onBack={() => router.push(`/students/${studentId}`)}
      />

      {/* Form */}
      <StudentForm
        mode="edit"
        initialData={student}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
