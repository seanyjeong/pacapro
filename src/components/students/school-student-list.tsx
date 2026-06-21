'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  School, Users, ChevronLeft, UserCheck, Sparkles, Clock,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Student } from '@/lib/types/student';

interface SchoolStudentListProps {
  students: Student[];
  loading: boolean;
  onStudentClick: (id: number) => void;
}

// 학교명 정규화 함수
function normalizeSchoolName(school: string | null): string {
  if (!school || school.trim() === '') return '미입력';

  let normalized = school.trim();

  // "XX고등학교" → "XX고"
  if (normalized.endsWith('고등학교')) {
    normalized = normalized.replace('고등학교', '고');
  }
  // "XX중학교" → "XX중"
  else if (normalized.endsWith('중학교')) {
    normalized = normalized.replace('중학교', '중');
  }
  // 이미 "XX고" 또는 "XX중"인 경우 그대로
  // 그 외의 경우도 그대로 유지

  return normalized;
}

// 필터 타입
type StatusFilter = 'active' | 'trial' | 'pending' | 'all';

export function SchoolStudentList({ students, loading, onStudentClick }: SchoolStudentListProps) {
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // 상태별 필터링
  const filteredByStatus = useMemo(() => {
    if (statusFilter === 'all') return students;
    if (statusFilter === 'active') return students.filter(s => s.status === 'active');
    if (statusFilter === 'trial') return students.filter(s => s.status === 'trial');
    if (statusFilter === 'pending') return students.filter(s => s.status === 'pending');
    return students;
  }, [students, statusFilter]);

  // 학교별 그룹핑
  const schoolGroups = useMemo(() => {
    const groups: Record<string, Student[]> = {};

    filteredByStatus.forEach(student => {
      const normalizedSchool = normalizeSchoolName(student.school);
      if (!groups[normalizedSchool]) {
        groups[normalizedSchool] = [];
      }
      groups[normalizedSchool].push(student);
    });

    // 학생 수 기준 내림차순 정렬, 미입력은 마지막
    return Object.entries(groups)
      .sort((a, b) => {
        if (a[0] === '미입력') return 1;
        if (b[0] === '미입력') return -1;
        return b[1].length - a[1].length;
      });
  }, [filteredByStatus]);

  // 선택된 학교의 학생들
  const selectedSchoolStudents = useMemo(() => {
    if (!selectedSchool) return [];
    return schoolGroups.find(([school]) => school === selectedSchool)?.[1] || [];
  }, [selectedSchool, schoolGroups]);

  // 상태 필터 버튼
  const filterButtons = [
    { id: 'active' as const, label: '재원생', icon: UserCheck, color: 'text-green-600' },
    { id: 'trial' as const, label: '체험생', icon: Sparkles, color: 'text-purple-600' },
    { id: 'pending' as const, label: '미등록', icon: Clock, color: 'text-orange-600' },
    { id: 'all' as const, label: '전체', icon: Users, color: 'text-blue-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 학교 카드 뷰
  if (!selectedSchool) {
    return (
      <div className="space-y-4">
        {/* 상태 필터 */}
        <div className="flex items-center gap-2">
          {filterButtons.map((btn) => {
            const Icon = btn.icon;
            const isActive = statusFilter === btn.id;
            return (
              <Button
                key={btn.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(btn.id)}
                className="gap-2"
              >
                <Icon className={cn('w-4 h-4', isActive ? '' : btn.color)} />
                {btn.label}
              </Button>
            );
          })}
        </div>

        {/* 통계 */}
        <div className="text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{schoolGroups.length}</span>개 학교,
          <span className="font-semibold text-foreground ml-1">{filteredByStatus.length}</span>명
        </div>

        {/* 학교 카드 그리드 */}
        {schoolGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              해당 조건의 학생이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {schoolGroups.map(([school, schoolStudents]) => (
              <Card
                key={school}
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary"
                onClick={() => setSelectedSchool(school)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <School className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-foreground truncate">{school}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{schoolStudents.length}</span>
                    <span className="text-sm text-muted-foreground">명</span>
                  </div>
                  {/* 상태별 작은 배지 */}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {statusFilter === 'all' && (
                      <>
                        {schoolStudents.filter(s => s.status === 'active').length > 0 && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            재원 {schoolStudents.filter(s => s.status === 'active').length}
                          </Badge>
                        )}
                        {schoolStudents.filter(s => s.status === 'trial').length > 0 && (
                          <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                            체험 {schoolStudents.filter(s => s.status === 'trial').length}
                          </Badge>
                        )}
                        {schoolStudents.filter(s => s.status === 'pending').length > 0 && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            미등록 {schoolStudents.filter(s => s.status === 'pending').length}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 학교 상세 (학생 명단)
  return (
    <div className="space-y-4">
      {/* 뒤로가기 */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedSchool(null)}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          학교 목록
        </Button>
        <div className="flex items-center gap-2">
          <School className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-foreground">{selectedSchool}</h3>
          <Badge variant="secondary">{selectedSchoolStudents.length}명</Badge>
        </div>
      </div>

      {/* 학생 목록 테이블 */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">이름</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">학년</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">상태</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">연락처</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {selectedSchoolStudents.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onStudentClick(student.id)}
                >
                  <td className="p-3">
                    <span className="font-medium text-foreground">{student.name}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{student.grade || '-'}</td>
                  <td className="p-3">
                    {student.status === 'active' && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">재원</Badge>
                    )}
                    {student.status === 'trial' && (
                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">체험</Badge>
                    )}
                    {student.status === 'pending' && (
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">미등록</Badge>
                    )}
                    {student.status === 'paused' && (
                      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">휴원</Badge>
                    )}
                    {student.status === 'withdrawn' && (
                      <Badge variant="secondary">퇴원</Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{student.phone || student.parent_phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
