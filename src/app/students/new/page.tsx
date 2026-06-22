'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { StudentForm } from '@/components/students/student-form';
import { StudentFormCancelDialog } from '@/features/student-form/student-form-cancel-dialog';
import { StudentFormPageHeader } from '@/features/student-form/student-form-page-header';
import { studentsAPI } from '@/lib/api/students';
import { seasonsApi } from '@/lib/api/seasons';
import type { StudentFormData, Student, Gender, StudentType, Grade, StudentStatus } from '@/lib/types/student';

function NewStudentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTrial = searchParams.get('is_trial') === 'true';
  const [cancelOpen, setCancelOpen] = useState(false);

  // 미등록관리 또는 체험생에서 넘어온 경우 학생 정보 초기값 설정
  const fromPendingId = searchParams.get('from_pending');
  const fromTrialId = searchParams.get('from_trial');
  const existingStudentId = fromPendingId || fromTrialId;
  const initialData = useMemo(() => {
    if (!existingStudentId) return undefined;

    return {
      id: parseInt(existingStudentId),
      name: searchParams.get('name') || '',
      phone: searchParams.get('phone') || '',
      parent_phone: searchParams.get('parent_phone') || '',
      student_type: (searchParams.get('student_type') || 'exam') as StudentType,
      grade: (searchParams.get('grade') || '') as Grade,
      school: searchParams.get('school') || '',
      gender: (searchParams.get('gender') || undefined) as Gender | undefined,
      class_days: searchParams.get('class_days') || '[]',
      weekly_count: parseInt(searchParams.get('weekly_count') || '0'),
      monthly_tuition: searchParams.get('monthly_tuition') || '0',
      time_slot: (searchParams.get('time_slot') || 'evening') as 'morning' | 'afternoon' | 'evening',
    } as Partial<Student>;
  }, [existingStudentId, searchParams]);

  const handleSubmit = async (data: StudentFormData) => {
    try {
      let student: Student;

      // 미등록관리 또는 체험생에서 온 경우: 기존 학생 UPDATE (id 유지, 상담 기록 보존)
      if (existingStudentId) {
        const updateData = {
          ...data,
          status: 'active' as StudentStatus,
          is_trial: false,
        };
        const response = await studentsAPI.updateStudent(parseInt(existingStudentId), updateData, { suppressErrorToast: true });
        student = response.student;
      } else {
        // 신규 등록: 새 학생 생성
        const response = await studentsAPI.createStudent(data, { suppressErrorToast: true });
        student = response.student;
      }

      // 시즌 등록이 선택된 경우
      if (data.enroll_in_season && data.selected_season_id) {
        try {
          // 시즌 정보 가져오기
          const seasonDetail = await seasonsApi.getSeason(data.selected_season_id);
          const seasonFee = parseFloat(seasonDetail.season.default_season_fee) || 0;

          await seasonsApi.enrollStudent(data.selected_season_id, {
            student_id: student.id,
            season_fee: seasonFee,
            registration_date: data.enrollment_date || new Date().toISOString().split('T')[0],
          });

          toast.success(`${student.name} 학생이 등록되었습니다!`, {
            description: '시즌 등록도 완료되었습니다.'
          });
        } catch (seasonError) {
          console.warn('Season enrollment failed:', seasonError);
          toast.warning(`${student.name} 학생이 등록되었습니다.`, {
            description: '시즌 등록에 실패했습니다. 학생 상세 페이지에서 다시 시도해주세요.'
          });
        }
      } else {
        toast.success(`${student.name} 학생이 등록되었습니다!`);
      }

      // 학생 목록으로 이동
      router.push('/students');
    } catch (error: unknown) {
      console.warn('학생 등록 저장에 실패했습니다.');
      throw error; // StudentForm에서 에러 처리
    }
  };

  const handleCancel = () => {
    setCancelOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <StudentFormPageHeader
        description="학생 기본 정보, 수업 정보, 학원비 기준을 한 번에 저장합니다."
        eyebrow="Student Intake"
        title="학생 등록"
        onBack={handleCancel}
      />

      {/* Form */}
      <StudentForm
        mode="create"
        initialData={initialData as Student | undefined}
        initialIsTrial={isTrial}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      <StudentFormCancelDialog
        mode="create"
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onLeave={() => router.push('/students')}
      />
    </div>
  );
}

// Suspense로 감싸서 export (useSearchParams 사용 위해)
export default function NewStudentPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewStudentContent />
    </Suspense>
  );
}
