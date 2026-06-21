'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { InstructorForm } from '@/components/instructors/instructor-form';
import { instructorsAPI } from '@/lib/api/instructors';
import type { InstructorFormData } from '@/lib/types/instructor';

export default function NewInstructorPage() {
  const router = useRouter();

  const handleSubmit = async (data: InstructorFormData) => {
    try {
      await instructorsAPI.createInstructor(data);

      // 성공 시 목록 페이지로 이동
      router.push('/instructors');
    } catch (error) {
      console.error('Failed to create instructor:', error);
      throw error; // 폼에서 에러 처리하도록 전달
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">강사 등록</h1>
          <p className="text-muted-foreground mt-1">새로운 강사를 등록합니다</p>
        </div>
      </div>

      {/* Form */}
      <InstructorForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
