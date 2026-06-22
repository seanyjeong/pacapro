'use client';

import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StudentForm } from '@/components/students/student-form';
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
        <Button variant="outline" size="sm" onClick={() => router.push(`/students/${studentId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          돌아가기
        </Button>

        <Card className="rounded-md shadow-none">
          <CardContent className="flex min-h-[260px] items-center justify-center p-8 text-center">
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              학생 정보를 불러오는 중입니다
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 에러 화면
  if (error || !student) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <Button variant="outline" size="sm" onClick={() => router.push('/students')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>

        <Card className="rounded-md border-rose-200 bg-rose-50 shadow-none dark:border-rose-900/70 dark:bg-rose-950/30" role="alert">
          <CardContent className="flex min-h-[260px] items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <AlertCircle className="mx-auto h-10 w-10 text-rose-800 dark:text-rose-100" />
              <h3 className="mt-4 text-base font-semibold text-rose-950 dark:text-rose-100">학생 정보를 불러올 수 없습니다</h3>
              <p className="mt-2 text-sm text-rose-800 dark:text-rose-200">{error || '잠시 후 다시 시도해 주세요.'}</p>
              <Button className="mt-5" variant="outline" onClick={reload}>다시 시도</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="border-b border-border/70 pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/students/${studentId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          돌아가기
        </Button>

        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Student Profile</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">학생 정보 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">{student.name} 학생의 정보, 수업 요일, 학원비 기준을 수정합니다.</p>
      </header>

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
