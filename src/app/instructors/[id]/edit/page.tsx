'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { InstructorForm } from '@/components/instructors/instructor-form';
import { useInstructor } from '@/hooks/use-instructors';
import { instructorsAPI } from '@/lib/api/instructors';
import type { InstructorFormData } from '@/lib/types/instructor';
import { Button } from '@/components/ui/button';

export default function EditInstructorPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = Number(params.id);

  const { instructor, loading, error, reload } = useInstructor(instructorId);

  const handleSubmit = async (data: InstructorFormData) => {
    try {
      await instructorsAPI.updateInstructor(instructorId, data);

      // 성공 시 상세 페이지로 이동
      router.push(`/instructors/${instructorId}`);
    } catch (error) {
      console.error('Failed to update instructor:', error);
      throw error; // 폼에서 에러 처리하도록 전달
    }
  };

  const handleCancel = () => {
    router.back();
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">강사 수정</h1>
            <p className="text-gray-600 mt-1">강사 정보를 불러오는 중...</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">강사 정보를 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 에러 화면
  if (error || !instructor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">강사 수정</h1>
            <p className="text-gray-600 mt-1">강사 정보 조회 실패</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
            <p className="text-gray-600 mb-4">{error || '강사 정보를 찾을 수 없습니다.'}</p>
            <div className="flex items-center justify-center space-x-3">
              <Button variant="outline" onClick={() => router.back()}>
                뒤로 가기
              </Button>
              <Button onClick={reload}>다시 시도</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">강사 수정</h1>
          <p className="text-gray-600 mt-1">{instructor.name} 강사의 정보를 수정합니다</p>
        </div>
      </div>

      {/* Form */}
      <InstructorForm
        mode="edit"
        initialData={instructor}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
