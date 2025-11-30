'use client';

import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, AlertCircle } from 'lucide-react';
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

  // useStudent 훅 사용
  const { student, loading, error, reload } = useStudent(studentId);

  const handleSubmit = async (data: StudentFormData) => {
    try {
      const response = await studentsAPI.updateStudent(studentId, data);

      // 성공 알림
      toast.success(`${response.student.name} 학생 정보가 수정되었습니다!`);

      // 상세 페이지로 이동
      router.push(`/students/${studentId}`);
    } catch (error: any) {
      console.error('Failed to update student:', error);
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
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/students/${studentId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          돌아가기
        </Button>

        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">학생 정보를 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 에러 화면
  if (error || !student) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/students')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          목록으로
        </Button>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">학생 정보를 불러올 수 없습니다</h3>
            <p className="text-gray-600 mb-4">{error || '학생을 찾을 수 없습니다.'}</p>
            <Button onClick={reload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/students/${studentId}`)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          돌아가기
        </Button>

        <h1 className="text-3xl font-bold text-gray-900">학생 정보 수정</h1>
        <p className="text-gray-600 mt-1">{student.name} 학생의 정보를 수정합니다</p>
      </div>

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
