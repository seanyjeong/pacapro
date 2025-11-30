'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Edit, Trash2, AlertCircle } from 'lucide-react';
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
      await instructorsAPI.deleteInstructor(instructorId);
      toast.success('강사가 삭제되었습니다.');
      router.push('/instructors');
    } catch (err: any) {
      console.error('Failed to delete instructor:', err);
      toast.error(err.response?.data?.message || '강사 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
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
            <h1 className="text-3xl font-bold text-gray-900">강사 상세</h1>
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
            <h1 className="text-3xl font-bold text-gray-900">강사 상세</h1>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{instructor.name}</h1>
            <p className="text-gray-600 mt-1">강사 상세 정보</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={reload}>
            새로고침
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="w-4 h-4 mr-2" />
            수정
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <InstructorCard instructor={instructor} />

      {/* 출퇴근 기록 */}
      <InstructorAttendanceComponent attendances={attendances} loading={false} />

      {/* 급여 기록 */}
      <InstructorSalaries salaries={salaries} loading={false} />
    </div>
  );
}
