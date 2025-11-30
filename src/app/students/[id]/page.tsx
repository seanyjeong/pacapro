'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { StudentCard } from '@/components/students/student-card';
import { StudentPerformanceComponent } from '@/components/students/student-performance';
import { StudentPaymentsComponent } from '@/components/students/student-payments';
import { StudentSeasonsComponent } from '@/components/students/student-seasons';
import { useStudent } from '@/hooks/use-students';
import { studentsAPI } from '@/lib/api/students';

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = parseInt(params.id as string);

  const [activeTab, setActiveTab] = useState<'performance' | 'payments' | 'seasons'>('performance');

  // useStudent 훅 사용
  const { student, performances, payments, loading, error, reload } = useStudent(studentId);

  // 수정 페이지로 이동
  const handleEdit = () => {
    router.push(`/students/${studentId}/edit`);
  };

  // 학생 삭제
  const handleDelete = async () => {
    if (!student) return;

    if (!confirm(`정말 "${student.name}" 학생을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await studentsAPI.deleteStudent(studentId);
      toast.success(`${student.name} 학생이 삭제되었습니다.`);
      router.push('/students');
    } catch (err: any) {
      console.error('Failed to delete student:', err);
      toast.error(err.response?.data?.message || '학생 삭제에 실패했습니다.');
    }
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/students')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          목록으로
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
        <Button variant="outline" size="sm" onClick={() => router.push('/students')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          목록으로
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">학생 상세</h1>
            <p className="text-gray-600 mt-1">{student.name} 학생의 상세 정보</p>
          </div>
        </div>
      </div>

      {/* 학생 기본 정보 카드 */}
      <StudentCard student={student} onEdit={handleEdit} onDelete={handleDelete} />

      {/* 탭 메뉴 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('performance')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'performance'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            성적 기록 (추후)
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'payments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            납부 내역
            {payments.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                {payments.length}
              </span>
            )}
          </button>
          {/* 입시생만 시즌 탭 표시 */}
          {student.student_type === 'exam' && (
            <button
              onClick={() => setActiveTab('seasons')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'seasons'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              시즌 등록
            </button>
          )}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div>
        {activeTab === 'performance' && (
          <StudentPerformanceComponent performances={performances} loading={false} />
        )}
        {activeTab === 'payments' && (
          <StudentPaymentsComponent payments={payments} loading={false} />
        )}
        {activeTab === 'seasons' && (
          <StudentSeasonsComponent studentId={studentId} studentType={student.student_type} />
        )}
      </div>
    </div>
  );
}
