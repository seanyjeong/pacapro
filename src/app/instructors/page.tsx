'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';
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

  const handleResetFilters = () => {
    setSearchQuery('');
    resetFilters();
  };

  if (error && !loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <header>
          <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">PACA Instructor Desk</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 운영</h1>
        </header>

        <section className="flex min-h-[320px] items-center justify-center rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
          <div>
            <AlertCircle className="mx-auto h-9 w-9" />
            <h2 className="mt-4 text-base font-semibold">강사 정보를 불러오지 못했습니다</h2>
            <p className="mt-2 text-sm text-red-800 dark:text-red-200">잠시 후 다시 시도해 주세요.</p>
            <Button variant="outline" className="mt-5 gap-2" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
              다시 불러오기
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">PACA Instructor Desk</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">강사 운영</h1>
          <p className="mt-1 text-sm text-muted-foreground">급여 방식, 재직 상태, 출퇴근 기록을 한 화면에서 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
          <Button className="gap-2" onClick={handleAddInstructor}>
            <Plus className="h-4 w-4" />
            강사 등록
          </Button>
        </div>
      </header>

      <InstructorStatsCards instructors={instructors} />

      <InstructorFiltersComponent
        filters={filters}
        onFilterChange={updateFilters}
        onReset={handleResetFilters}
      />

      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <InstructorSearch value={searchQuery} onChange={handleSearch} />
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{instructors.length}</span>명
        </div>
      </section>

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
    </div>
  );
}
