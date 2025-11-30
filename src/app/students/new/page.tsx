'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentForm } from '@/components/students/student-form';
import { studentsAPI } from '@/lib/api/students';
import { seasonsApi } from '@/lib/api/seasons';
import type { StudentFormData } from '@/lib/types/student';

export default function NewStudentPage() {
  const router = useRouter();

  const handleSubmit = async (data: StudentFormData) => {
    try {
      // 1. 학생 등록
      const response = await studentsAPI.createStudent(data);
      const newStudent = response.student;

      // 2. 시즌 등록이 선택된 경우
      if (data.enroll_in_season && data.selected_season_id) {
        try {
          // 시즌 정보 가져오기
          const seasonDetail = await seasonsApi.getSeason(data.selected_season_id);
          const seasonFee = parseFloat(seasonDetail.season.default_season_fee) || 0;

          await seasonsApi.enrollStudent(data.selected_season_id, {
            student_id: newStudent.id,
            season_fee: seasonFee,
            registration_date: data.enrollment_date || new Date().toISOString().split('T')[0],
          });

          toast.success(`${newStudent.name} 학생이 등록되었습니다!`, {
            description: '시즌 등록도 완료되었습니다.'
          });
        } catch (seasonError) {
          console.error('Season enrollment failed:', seasonError);
          toast.warning(`${newStudent.name} 학생이 등록되었습니다.`, {
            description: '시즌 등록에 실패했습니다. 학생 상세 페이지에서 다시 시도해주세요.'
          });
        }
      } else {
        toast.success(`${newStudent.name} 학생이 등록되었습니다!`);
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

        <h1 className="text-3xl font-bold text-gray-900">학생 등록</h1>
        <p className="text-gray-600 mt-1">새로운 학생 정보를 등록합니다</p>
      </div>

      {/* Form */}
      <StudentForm mode="create" onSubmit={handleSubmit} onCancel={handleCancel} />

      {/* 안내 */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">안내사항</h4>
            <ul className="text-sm text-blue-800 space-y-1">
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
