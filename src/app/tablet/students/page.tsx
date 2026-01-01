'use client';

/**
 * 태블릿 학생 관리 페이지
 * - PC 컴포넌트 재사용
 * - 태블릿에 최적화된 레이아웃
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Users, UserCheck, UserX, Sparkles, Clock, Loader2, School, GraduationCap, RefreshCw, Search, X } from 'lucide-react';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { StudentListTable } from '@/components/students/student-list-table';
import { TrialStudentList } from '@/components/students/trial-student-list';
import { PendingStudentList } from '@/components/students/pending-student-list';
import { useStudents } from '@/hooks/use-students';
import { cn } from '@/lib/utils';
import type { StudentStatus } from '@/lib/types/student';

// 탭 타입
type StudentTab = 'active' | 'paused' | 'withdrawn' | 'trial' | 'pending' | 'graduated';

// 내부 컴포넌트 (useSearchParams 사용)
function TabletStudentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as StudentTab | null;

  // 초기 탭 결정 (URL 파라미터 우선)
  const initialTab: StudentTab = tabParam && ['active', 'paused', 'withdrawn', 'trial', 'pending', 'graduated'].includes(tabParam)
    ? tabParam
    : 'active';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StudentTab>(initialTab);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);

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
  const { students, loading, error, filters, setFilters, updateFilters, reload } = useStudents({
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
  }, [activeTab]);

  // 검색어 필터링 적용
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    updateFilters({ search: query });
  };

  // 학생 클릭 → 상세 페이지로 이동
  const handleStudentClick = (id: number) => {
    router.push(`/tablet/students/${id}`);
  };

  // 에러 화면
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">학생 관리</h1>
          <p className="text-muted-foreground">학생 조회</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleReload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 탭 정의
  const tabs = [
    { id: 'active' as const, label: '재원생', icon: UserCheck, color: 'text-green-600 dark:text-green-400' },
    { id: 'paused' as const, label: '휴원', icon: Users, color: 'text-yellow-600 dark:text-yellow-400' },
    { id: 'trial' as const, label: '체험생', icon: Sparkles, color: 'text-purple-600 dark:text-purple-400' },
    { id: 'pending' as const, label: '미등록', icon: Clock, color: 'text-orange-600 dark:text-orange-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">학생 관리</h1>
          <p className="text-muted-foreground">학생 조회</p>
        </div>
        <Button variant="outline" onClick={handleReload}>
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? tab.color : '')} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 통계 카드 */}
      <StudentStatsCards refreshTrigger={statsRefreshTrigger} />

      {/* 검색 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="학생 이름, 학교로 검색..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-border rounded-lg text-sm bg-card text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              총 <span className="font-semibold text-foreground">{students.length}</span>명
            </div>
          </div>
        </CardContent>
      </Card>

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
          onReload={handleReload}
        />
      ) : (
        <StudentListTable
          students={students}
          loading={loading}
          onStudentClick={handleStudentClick}
        />
      )}

      {/* 안내 */}
      {!loading && students.length === 0 && !searchQuery && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">안내</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  해당 상태의 학생이 없습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 로딩 폴백
function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">학생 관리</h1>
        <p className="text-muted-foreground">학생 조회</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
