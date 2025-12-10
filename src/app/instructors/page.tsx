'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Download, AlertCircle } from 'lucide-react';
import { InstructorStatsCards } from '@/components/instructors/instructor-stats-cards';
import { InstructorFiltersComponent } from '@/components/instructors/instructor-filters';
import { InstructorSearch } from '@/components/instructors/instructor-search';
import { InstructorListTable } from '@/components/instructors/instructor-list-table';
import { useInstructors } from '@/hooks/use-instructors';

export default function InstructorsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // useInstructors 훅 사용
  const { instructors, loading, error, filters, updateFilters, resetFilters, reload } = useInstructors();

  // 검색어 필터링 적용
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    updateFilters({ search: query });
  };

  // 강사 클릭 → 상세 페이지로 이동
  const handleInstructorClick = (id: number) => {
    router.push(`/instructors/${id}`);
  };

  // 강사 등록 페이지로 이동
  const handleAddInstructor = () => {
    router.push('/instructors/new');
  };

  // 에러 화면
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">강사 관리</h1>
          <p className="text-muted-foreground mt-1">강사 등록 및 관리</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
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
          <h1 className="text-3xl font-bold text-foreground">강사 관리</h1>
          <p className="text-muted-foreground mt-1">강사 등록 및 관리</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={reload}>
            새로고침
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            엑셀 다운로드
          </Button>
          <Button onClick={handleAddInstructor}>
            <Plus className="w-4 h-4 mr-2" />
            강사 등록
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <InstructorStatsCards instructors={instructors} />

      {/* 필터 */}
      <InstructorFiltersComponent
        filters={filters}
        onFilterChange={updateFilters}
        onReset={resetFilters}
      />

      {/* 검색 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <InstructorSearch value={searchQuery} onChange={handleSearch} />
        </div>
        <div className="text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{instructors.length}</span>명
        </div>
      </div>

      {/* 강사 목록 테이블 */}
      <InstructorListTable
        instructors={instructors}
        loading={loading}
        onInstructorClick={handleInstructorClick}
      />

      {/* 안내 */}
      {!loading && instructors.length === 0 && !searchQuery && !filters.status && !filters.salary_type && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">시작하기</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  강사를 등록하시면 급여, 출퇴근 등을 관리할 수 있습니다.
                  <br />
                  우측 상단의 "강사 등록" 버튼을 클릭하여 첫 강사를 등록해보세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
