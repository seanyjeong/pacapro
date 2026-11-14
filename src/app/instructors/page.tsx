'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, Banknote, CalendarDays, MoreHorizontal, Plus, RefreshCw, Smartphone } from 'lucide-react';
import { InstructorStatsCards } from '@/components/instructors/instructor-stats-cards';
import { InstructorFiltersComponent } from '@/components/instructors/instructor-filters';
import { InstructorSearch } from '@/components/instructors/instructor-search';
import { InstructorListTable } from '@/components/instructors/instructor-list-table';
import { InstructorPageHeader } from '@/features/instructors/instructor-page-header';
import { InstructorErrorPanel } from '@/features/instructors/instructor-page-states';
import { useInstructors } from '@/hooks/use-instructors';
import type { InstructorFilters } from '@/lib/types/instructor';

const QUICK_LINKS = [
  { href: '/schedules', label: '수업스케줄', icon: CalendarDays },
  { href: '/salaries', label: '급여 관리', icon: Banknote },
  { href: '/m/instructor', label: '모바일 출근', icon: Smartphone },
];

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
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <InstructorPageHeader
          description="강사 목록을 다시 불러올 수 있어요."
          title="강사 운영"
        />
        <InstructorErrorPanel message={error} onRetry={reload} title="강사 정보를 불러오지 못했습니다" />
      </div>
    );
  }

  const statusKey = !filters.status && !filters.salary_type && !filters.search
    ? 'all'
    : filters.status === 'active' || filters.status === 'on_leave' ? filters.status : null;

  const handleStatSelect = (key: 'all' | 'active' | 'on_leave') => {
    if (key === 'all') handleResetFilters();
    else handleBoardFilter({ status: key });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4" data-testid="instructors-operations-workspace">
      <InstructorPageHeader
        actions={
          <>
            <Button variant="outline" size="icon" onClick={reload} title="새로고침" aria-label="새로고침">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="연결 업무" aria-label="연결 업무">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {QUICK_LINKS.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href} className="gap-2">
                      <link.icon className="h-4 w-4 text-muted-foreground" />
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleAddInstructor}>
              <Plus className="h-4 w-4" />
              강사 등록
            </Button>
          </>
        }
        description="급여 방식·재직 상태·출퇴근 기록을 한 화면에서 봐요."
        title="강사 운영"
      />

      <InstructorStatsCards instructors={instructors} activeKey={statusKey} onSelect={handleStatSelect} />

      <section className="min-w-0 space-y-4 rounded-2xl bg-card p-5 sm:p-6" aria-label="강사 목록">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="min-w-0 lg:w-80 lg:shrink-0">
            <InstructorSearch value={searchQuery} onChange={handleSearch} />
          </div>
          <InstructorFiltersComponent
            filters={filters}
            onFilterChange={updateFilters}
            onReset={handleResetFilters}
          />
        </div>
        <p className="text-[13px] text-muted-foreground">
          총 <span className="font-bold tabular-nums text-foreground">{instructors.length}</span>명
        </p>

        <InstructorListTable
          instructors={instructors}
          loading={loading}
          onInstructorClick={handleInstructorClick}
        />
      </section>

      {!loading && instructors.length === 0 && !searchQuery && !filters.status && !filters.salary_type && (
        <section className="flex items-start gap-3 rounded-2xl bg-primary-soft px-5 py-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-foreground">시작하기</h2>
            <p className="mt-0.5 text-sm text-secondary-foreground">
              강사를 등록하면 급여 방식·재직 상태·출퇴근 기록을 함께 관리할 수 있어요.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
