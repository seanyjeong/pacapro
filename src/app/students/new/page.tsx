'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentForm } from '@/components/students/student-form';
import { studentsAPI } from '@/lib/api/students';
import { seasonsApi } from '@/lib/api/seasons';
import apiClient from '@/lib/api/client';
import type { StudentFormData, Student, Gender, StudentType, Grade, StudentStatus } from '@/lib/types/student';

function NewStudentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTrial = searchParams.get('is_trial') === 'true';

  // 미등록관리에서 넘어온 경우 학생 정보 초기값 설정
  const fromPendingId = searchParams.get('from_pending');
  const initialData = useMemo(() => {
    if (!fromPendingId) return undefined;

    return {
      id: parseInt(fromPendingId),
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
  }, [fromPendingId, searchParams]);

  const handleSubmit = async (data: StudentFormData) => {
    try {
      let student: Student;

      // 미등록관리에서 온 경우: 기존 학생 UPDATE (id 유지)
      if (fromPendingId) {
        const updateData = {
          ...data,
          status: 'active' as StudentStatus,  // pending → active 전환
          is_trial: false,
        };
        const response = await studentsAPI.updateStudent(parseInt(fromPendingId), updateData);
        student = response.student;
      } else {
        // 신규 등록: 새 학생 생성
        const response = await studentsAPI.createStudent(data);
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
          console.error('Season enrollment failed:', seasonError);
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
      console.error('Failed to create student:', error);
      throw error; // StudentForm에서 에러 처리
    }
  };

  const handleCancel = () => {
    if (confirm('작성 중인 내용이 사라집니다. 취소하시겠습니까?')) {
      router.push('/students');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/students')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          목록으로
        </Button>

        <h1 className="text-3xl font-bold text-foreground">학생 등록</h1>
        <p className="text-muted-foreground mt-1">새로운 학생 정보를 등록합니다</p>
      </div>

      {/* Form */}
      <StudentForm
        mode="create"
        initialData={initialData as Student | undefined}
        initialIsTrial={isTrial}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      {/* 안내 */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">안내사항</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• 학번을 입력하지 않으면 자동으로 생성됩니다.</li>
              <li>• 필수 항목(*)은 반드시 입력해야 합니다.</li>
              <li>• 등록 후 학생 상세 페이지에서 수정할 수 있습니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Suspense로 감싸서 export (useSearchParams 사용 위해)
export default function NewStudentPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <NewStudentContent />
    </Suspense>
  );
}
