'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, AlertCircle, Users, UserCheck, UserX, Sparkles, Clock, Loader2, School, GraduationCap } from 'lucide-react';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { StudentFiltersComponent } from '@/components/students/student-filters';
import { StudentSearch } from '@/components/students/student-search';
import { StudentListTable } from '@/components/students/student-list-table';
import { TrialStudentList } from '@/components/students/trial-student-list';
import { PendingStudentList } from '@/components/students/pending-student-list';
import { SchoolStudentList } from '@/components/students/school-student-list';
import { useStudents } from '@/hooks/use-students';
import { PACA_API_BASE_URL } from '@/lib/api/base-url';
import { cn } from '@/lib/utils';
import type { StudentStatus, StudentFilters } from '@/lib/types/student';
import {
  STUDENT_TYPE_LABELS,
  GRADE_LABELS,
  ADMISSION_TYPE_LABELS,
  GENDER_LABELS,
} from '@/lib/types/student';

// 탭 타입
type StudentTab = 'active' | 'paused' | 'withdrawn' | 'trial' | 'pending' | 'graduated' | 'bySchool';

// 활성 필터 라벨 생성 함수
function getActiveFilterLabels(filters: StudentFilters): string[] {
  const labels: string[] = [];

  if (filters.grade) {
    labels.push(GRADE_LABELS[filters.grade]);
  }
  if (filters.student_type) {
    labels.push(STUDENT_TYPE_LABELS[filters.student_type]);
  }
  if (filters.admission_type) {
    labels.push(ADMISSION_TYPE_LABELS[filters.admission_type]);
  }
  if (filters.gender) {
    labels.push(GENDER_LABELS[filters.gender]);
  }

  return labels;
}

// 내부 컴포넌트 (useSearchParams 사용)
function StudentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as StudentTab | null;

  // 초기 탭 결정 (URL 파라미터 우선)
  const initialTab: StudentTab = tabParam && ['active', 'paused', 'withdrawn', 'trial', 'pending', 'graduated', 'bySchool'].includes(tabParam)
    ? tabParam
    : 'active';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StudentTab>(initialTab);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [excelDownloading, setExcelDownloading] = useState(false);

  // URL 파라미터로 탭 변경 시 적용
  useEffect(() => {
    if (tabParam && ['active', 'paused', 'withdrawn', 'trial', 'pending', 'graduated', 'bySchool'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // 탭을 status로 변환 (bySchool은 전체 학생 조회)
  const getStatusFromTab = (tab: StudentTab): StudentStatus | undefined => {
    if (tab === 'bySchool') return undefined;
    return tab as StudentStatus;
  };

  // useStudents 훅 사용 (초기값: URL 탭 파라미터에 맞게 설정)
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
    if (activeTab === 'trial') {
      updateFilters({ status: 'trial', is_trial: undefined });
    } else if (activeTab === 'active') {
      updateFilters({ status: 'active', is_trial: undefined });
    } else if (activeTab === 'paused') {
      updateFilters({ status: 'paused', is_trial: undefined });
    } else if (activeTab === 'withdrawn') {
      updateFilters({ status: 'withdrawn', is_trial: undefined });
    } else if (activeTab === 'pending') {
      updateFilters({ status: 'pending', is_trial: undefined });
    } else if (activeTab === 'graduated') {
      updateFilters({ status: 'graduated', is_trial: undefined });
    } else if (activeTab === 'bySchool') {
      // 학교별 탭: 모든 학생 (재원+체험+미등록) 가져오기
      updateFilters({ status: undefined, is_trial: undefined });
    }
  }, [activeTab]);

  // 탭별 학생 수 계산
  const tabCounts = {
    active: students.filter(s => s.status === 'active').length,
    paused: students.filter(s => s.status === 'paused').length,
    withdrawn: students.filter(s => s.status === 'withdrawn').length,
    trial: students.filter(s => s.status === 'trial').length,
    pending: students.filter(s => s.status === 'pending').length,
    graduated: students.filter(s => s.status === 'graduated').length,
  };

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

  // 엑셀 다운로드
  const handleExcelDownload = async () => {
    setExcelDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${PACA_API_BASE_URL}/exports/students`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 파일명 추출
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = '학생목록.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      alert('엑셀 다운로드에 실패했습니다.');
    } finally {
      setExcelDownloading(false);
    }
  };

  // 에러 화면
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">학생 관리</h1>
          <p className="text-muted-foreground mt-1">학생 등록 및 관리</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
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
    { id: 'paused' as const, label: '휴원생', icon: Users, color: 'text-yellow-600 dark:text-yellow-400' },
    { id: 'withdrawn' as const, label: '퇴원생', icon: UserX, color: 'text-muted-foreground' },
    { id: 'graduated' as const, label: '졸업생', icon: GraduationCap, color: 'text-indigo-600 dark:text-indigo-400' },
    { id: 'trial' as const, label: '체험생', icon: Sparkles, color: 'text-purple-600 dark:text-purple-400' },
    { id: 'pending' as const, label: '미등록관리', icon: Clock, color: 'text-orange-600 dark:text-orange-400' },
    { id: 'bySchool' as const, label: '학교별', icon: School, color: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">학생 관리</h1>
          <p className="text-muted-foreground mt-1">학생 등록 및 관리</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleReload}>
            새로고침
          </Button>
          <Button variant="outline" onClick={handleExcelDownload} disabled={excelDownloading}>
            {excelDownloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {excelDownloading ? '다운로드 중...' : '엑셀 다운로드'}
          </Button>
          <Button onClick={handleAddStudent}>
            <Plus className="w-4 h-4 mr-2" />
            {activeTab === 'trial' ? '체험생 등록' : '학생 등록'}
          </Button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors',
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

      {/* 통계 카드 - 모든 탭에서 전체 현황 표시 */}
      <StudentStatsCards refreshTrigger={statsRefreshTrigger} />

      {/* 체험생/미등록관리 탭이 아닐 때만 필터 표시 */}
      {activeTab !== 'trial' && activeTab !== 'pending' && (
        <StudentFiltersComponent
          filters={filters}
          onFilterChange={updateFilters}
          hideStatusFilter={true}
          onReset={() => {
            // 탭 기본 필터는 유지하면서 나머지만 초기화
            setSearchQuery('');
            if (activeTab === 'active') {
              setFilters({ status: 'active', is_trial: false });
            } else if (activeTab === 'paused') {
              setFilters({ status: 'paused', is_trial: false });
            } else if (activeTab === 'withdrawn') {
              setFilters({ status: 'withdrawn', is_trial: false });
            }
          }}
        />
      )}

      {/* 검색 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <StudentSearch value={searchQuery} onChange={handleSearch} />
        </div>
        <div className="text-sm text-muted-foreground">
          {(() => {
            const filterLabels = getActiveFilterLabels(filters);
            if (filterLabels.length > 0) {
              return (
                <>
                  <span className="font-medium text-primary">{filterLabels.join(', ')}</span>
                  {' '}
                  <span className="font-semibold text-foreground">({students.length}명)</span>
                </>
              );
            }
            return (
              <>
                총 <span className="font-semibold text-foreground">{students.length}</span>명
              </>
            );
          })()}
        </div>
      </div>

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
      ) : activeTab === 'bySchool' ? (
        <SchoolStudentList
          students={students}
          loading={loading}
          onStudentClick={handleStudentClick}
        />
      ) : (
        <StudentListTable
          students={students}
          loading={loading}
          onStudentClick={handleStudentClick}
        />
      )}

      {/* 안내 */}
      {!loading && students.length === 0 && !searchQuery && !filters.grade && !filters.student_type && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">시작하기</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
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

// 로딩 폴백
function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">학생 관리</h1>
        <p className="text-muted-foreground mt-1">학생 등록 및 관리</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

// 메인 페이지 (Suspense로 감싸서 export)
export default function StudentsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StudentsPageContent />
    </Suspense>
  );
}
