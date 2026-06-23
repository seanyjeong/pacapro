'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { InstructorStatsCards } from '@/components/instructors/instructor-stats-cards';
import { InstructorFiltersComponent } from '@/components/instructors/instructor-filters';
import { InstructorSearch } from '@/components/instructors/instructor-search';
import { InstructorListTable } from '@/components/instructors/instructor-list-table';
import { InstructorPageHeader } from '@/features/instructors/instructor-page-header';
import { InstructorErrorPanel } from '@/features/instructors/instructor-page-states';
import { InstructorsWorkQueue } from '@/features/instructors/instructors-work-queue';
import { useInstructors } from '@/hooks/use-instructors';
import type { InstructorFilters } from '@/lib/types/instructor';

export default function InstructorsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // useInstructors 훅 사용
  const { instructors, loading, error, filters, setFilters, updateFilters, resetFilters, reload } = useInstructors();

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

  const handleResetFilters = () => {
    setSearchQuery('');
    resetFilters();
  };

  const handleBoardFilter = (nextFilters: InstructorFilters) => {
    setSearchQuery('');
    setFilters(nextFilters);
  };

  if (error && !loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <InstructorPageHeader
          description="강사 목록을 다시 불러올 수 있습니다."
          eyebrow="PACA Instructor Desk"
          title="강사 운영"
        />
        <InstructorErrorPanel message={error} onRetry={reload} title="강사 정보를 불러오지 못했습니다" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5" data-testid="instructors-operations-workspace">
      <InstructorPageHeader
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
              새로고침
            </Button>
            <Button className="gap-2" onClick={handleAddInstructor}>
              <Plus className="h-4 w-4" />
              강사 등록
            </Button>
          </>
        }
        className="border-b-0 pb-0"
        description="급여 방식, 재직 상태, 출퇴근 기록을 한 화면에서 확인합니다."
        eyebrow="PACA Instructor Desk"
        title="강사 운영"
      />

      <InstructorStatsCards instructors={instructors} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <main className="order-2 min-w-0 space-y-5 xl:order-1">
          <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <InstructorSearch value={searchQuery} onChange={handleSearch} />
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              총 <span className="font-semibold text-foreground">{instructors.length}</span>명
            </div>
          </section>

          <InstructorFiltersComponent
            filters={filters}
            onFilterChange={updateFilters}
            onReset={handleResetFilters}
          />

          <InstructorListTable
            instructors={instructors}
            loading={loading}
            onInstructorClick={handleInstructorClick}
          />

          {!loading && instructors.length === 0 && !searchQuery && !filters.status && !filters.salary_type && (
            <section className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/70 dark:bg-blue-950/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-blue-700 dark:text-blue-300" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-blue-950 dark:text-blue-100">시작하기</h2>
                  <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                    강사를 등록하면 급여 방식, 재직 상태, 출퇴근 기록을 함께 관리할 수 있습니다.
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>

        <div className="order-1 xl:sticky xl:top-20 xl:order-2">
          <InstructorsWorkQueue
            currentCount={instructors.length}
            instructors={instructors}
            onAddInstructor={handleAddInstructor}
            onFilterChange={handleBoardFilter}
            onResetFilters={handleResetFilters}
          />
        </div>
      </div>
    </div>
  );
}
