'use client';

/**
 * 태블릿 학생 관리 페이지
 * - PC 컴포넌트 재사용
 * - 태블릿에 최적화된 레이아웃
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/page';
import { AlertCircle, Loader2, RefreshCw, Search, Users, X } from 'lucide-react';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { TrialStudentList } from '@/components/students/trial-student-list';
import { PendingStudentList } from '@/components/students/pending-student-list';
import { TabletStudentCardList } from '@/features/tablet-students/tablet-student-card-list';
import { useStudents } from '@/hooks/use-students';
import { cn } from '@/lib/utils';
import type { StudentStatus } from '@/lib/types/student';
import type { StudentListSort } from '@/features/students/student-page-types';
import { getNextSort } from '@/features/students/student-page-utils';

// 탭 타입
type StudentTab = 'active' | 'paused' | 'withdrawn' | 'trial' | 'pending' | 'graduated';

// 내부 컴포넌트 (useSearchParams 사용)
function TabletStudentsPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as StudentTab | null;

  // 초기 탭 결정 (URL 파라미터 우선)
  const initialTab: StudentTab = tabParam && ['active', 'paused', 'withdrawn', 'trial', 'pending', 'graduated'].includes(tabParam)
    ? tabParam
    : 'active';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StudentTab>(initialTab);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [pendingSort, setPendingSort] = useState<StudentListSort | null>(null);

  // URL 파라미터로 탭 변경 시 적용
  useEffect(() => {
    if (tabParam && ['active', 'paused', 'withdrawn', 'trial', 'pending', 'graduated'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // 탭을 status로 변환
  const getStatusFromTab = (tab: StudentTab): StudentStatus | undefined => {
    return tab as StudentStatus;
  };

  // useStudents 훅 사용
  const { students, loading, error, updateFilters, reload } = useStudents({
    status: getStatusFromTab(initialTab),
    is_trial: undefined
  });

  // 통계 카드도 함께 갱신하는 리로드
  const handleReload = () => {
    reload();
    setStatsRefreshTrigger(prev => prev + 1);
  };

  // 탭 변경 시 필터 업데이트
  useEffect(() => {
    updateFilters({ status: activeTab as StudentStatus, is_trial: undefined });
  }, [activeTab, updateFilters]);

  // 검색어 필터링 적용
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    updateFilters({ search: query });
  };

  // 에러 화면
  if (error && !loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="학생 관리" description="학생 조회" />

        <section className="rounded-2xl bg-card py-6">
          <EmptyState icon={AlertCircle} title="학생 정보를 불러오지 못했습니다" description="잠시 후 다시 시도해주세요." />
          <div className="flex justify-center pb-4">
            <Button onClick={handleReload}>다시 시도</Button>
          </div>
        </section>
      </div>
    );
  }

  // 탭 정의
  const tabs = [
    { id: 'active' as const, label: '재원생' },
    { id: 'paused' as const, label: '휴원' },
    { id: 'trial' as const, label: '체험생' },
    { id: 'pending' as const, label: '미등록' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="학생 관리"
        description="학생 조회"
        actions={(
          <Button variant="outline" onClick={handleReload}>
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
        )}
      />

      {/* 통계 카드 */}
      <StudentStatsCards refreshTrigger={statsRefreshTrigger} />

      {/* 상태 탭 + 검색 */}
      <section className="space-y-3 rounded-2xl bg-card p-4" aria-label="학생 찾기">
        <nav aria-label="학생 상태" className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors',
                  isActive ? 'bg-foreground text-background' : 'bg-muted text-secondary-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="학생 이름, 학교로 검색..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearch('')}
                aria-label="검색어 지우기"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="whitespace-nowrap text-sm text-muted-foreground">
            총 <span className="text-base font-extrabold text-foreground tabular-nums">{students.length}</span>명
          </div>
        </div>
      </section>

      {/* 학생 목록 - 탭에 따라 다른 컴포넌트 표시 */}
      {activeTab === 'trial' ? (
        <TrialStudentList
          students={students.filter(s => s.is_trial)}
          loading={loading}
          onReload={handleReload}
        />
      ) : activeTab === 'pending' ? (
        <PendingStudentList
          students={students}
          loading={loading}
          sort={pendingSort}
          onReload={handleReload}
          onSortChange={(key) => setPendingSort((current) => getNextSort(current, key))}
        />
      ) : (
        <TabletStudentCardList
          students={students}
          loading={loading}
        />
      )}

      {/* 안내 */}
      {!loading && students.length === 0 && !searchQuery && (
        <p className="flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary" role="note">
          <Users className="h-4 w-4 shrink-0" />
          해당 상태의 학생이 없어요.
        </p>
      )}
    </div>
  );
}

// 로딩 폴백
function LoadingFallback() {
  return (
    <div className="space-y-4">
      <PageHeader title="학생 관리" description="학생 조회" />
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

// 메인 페이지 (Suspense로 감싸서 export)
export default function TabletStudentsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TabletStudentsPageContent />
    </Suspense>
  );
}
