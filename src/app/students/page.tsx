'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Download, AlertCircle } from 'lucide-react';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { StudentFiltersComponent } from '@/components/students/student-filters';
import { StudentSearch } from '@/components/students/student-search';
import { StudentListTable } from '@/components/students/student-list-table';
import { useStudents } from '@/hooks/use-students';

export default function StudentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // useStudents 훅 사용
  const { students, loading, error, filters, updateFilters, resetFilters, reload } = useStudents();

  // 검색어 필터링 적용
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    updateFilters({ search: query });
  };

  // 학생 클릭 → 상세 페이지로 이동
  const handleStudentClick = (id: number) => {
    router.push(`/students/${id}`);
  };

  // 학생 등록 페이지로 이동
  const handleAddStudent = () => {
    router.push('/students/new');
  };

  // 에러 화면
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">학생 관리</h1>
          <p className="text-gray-600 mt-1">학생 등록 및 관리</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={reload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">학생 관리</h1>
          <p className="text-gray-600 mt-1">학생 등록 및 관리</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={reload}>
            새로고침
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            엑셀 다운로드
          </Button>
          <Button onClick={handleAddStudent}>
            <Plus className="w-4 h-4 mr-2" />
            학생 등록
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <StudentStatsCards students={students} />

      {/* 필터 */}
      <StudentFiltersComponent
        filters={filters}
        onFilterChange={updateFilters}
        onReset={resetFilters}
      />

      {/* 검색 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <StudentSearch value={searchQuery} onChange={handleSearch} />
        </div>
        <div className="text-sm text-gray-600">
          총 <span className="font-semibold text-gray-900">{students.length}</span>명
        </div>
      </div>

      {/* 학생 목록 테이블 */}
      <StudentListTable
        students={students}
        loading={loading}
        onStudentClick={handleStudentClick}
      />

      {/* 안내 */}
      {!loading && students.length === 0 && !searchQuery && !filters.grade && !filters.student_type && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">시작하기</h4>
                <p className="text-sm text-blue-800">
                  학생을 등록하시면 학원비, 성적, 출석 등을 관리할 수 있습니다.
                  <br />
                  우측 상단의 "학생 등록" 버튼을 클릭하여 첫 학생을 등록해보세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
