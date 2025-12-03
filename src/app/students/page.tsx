'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, AlertCircle, Users, UserCheck, UserX, Sparkles } from 'lucide-react';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { StudentFiltersComponent } from '@/components/students/student-filters';
import { StudentSearch } from '@/components/students/student-search';
import { StudentListTable } from '@/components/students/student-list-table';
import { TrialStudentList } from '@/components/students/trial-student-list';
import { useStudents } from '@/hooks/use-students';
import { cn } from '@/lib/utils';

// 탭 타입
type StudentTab = 'active' | 'paused' | 'withdrawn' | 'trial';

export default function StudentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StudentTab>('active');

  // useStudents 훅 사용 (초기값: 재원생만)
  const { students, loading, error, filters, setFilters, updateFilters, reload } = useStudents({ status: 'active', is_trial: false });

  // 탭 변경 시 필터 업데이트
  useEffect(() => {
    if (activeTab === 'trial') {
      updateFilters({ status: undefined, is_trial: true });
    } else if (activeTab === 'active') {
      updateFilters({ status: 'active', is_trial: false });
    } else if (activeTab === 'paused') {
      updateFilters({ status: 'paused', is_trial: false });
    } else if (activeTab === 'withdrawn') {
      updateFilters({ status: 'withdrawn', is_trial: false });
    }
  }, [activeTab]);

  // 탭별 학생 수 계산 (체험생은 별도 API 호출 필요하므로 일단 표시 안 함)
  const tabCounts = {
    active: students.filter(s => s.status === 'active' && !s.is_trial).length,
    paused: students.filter(s => s.status === 'paused' && !s.is_trial).length,
    withdrawn: students.filter(s => s.status === 'withdrawn' && !s.is_trial).length,
    trial: students.filter(s => s.is_trial).length,
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

  // 탭 정의
  const tabs = [
    { id: 'active' as const, label: '재원생', icon: UserCheck, color: 'text-green-600' },
    { id: 'paused' as const, label: '휴원생', icon: Users, color: 'text-yellow-600' },
    { id: 'withdrawn' as const, label: '퇴원생', icon: UserX, color: 'text-gray-600' },
    { id: 'trial' as const, label: '체험생', icon: Sparkles, color: 'text-purple-600' },
  ];

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
            {activeTab === 'trial' ? '체험생 등록' : '학생 등록'}
          </Button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
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
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? tab.color : '')} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 체험생 탭이 아닐 때만 통계 카드 표시 */}
      {activeTab !== 'trial' && <StudentStatsCards students={students} />}

      {/* 체험생 탭이 아닐 때만 필터 표시 */}
      {activeTab !== 'trial' && (
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
        <div className="text-sm text-gray-600">
          총 <span className="font-semibold text-gray-900">{students.length}</span>명
        </div>
      </div>

      {/* 학생 목록 - 탭에 따라 다른 컴포넌트 표시 */}
      {activeTab === 'trial' ? (
        <TrialStudentList
          students={students.filter(s => s.is_trial)}
          loading={loading}
          onReload={reload}
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
