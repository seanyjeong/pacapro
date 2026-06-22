/**
 * Student Stats Cards Component
 * 학생 통계 카드 컴포넌트 - 전체 학생 현황 (탭과 무관하게 고정)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, UserX, GraduationCap, Sparkles, Clock } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';

interface StudentStatsCardsProps {
  onStatsLoaded?: (stats: StudentStats) => void;
  refreshTrigger?: number; // 이 값이 변경될 때마다 리로드
}

interface StudentStats {
  total: number;
  active: number;
  paused: number;
  graduated: number;
  trial: number;
  pending: number;
}

export function StudentStatsCards({ onStatsLoaded, refreshTrigger }: StudentStatsCardsProps) {
  const [stats, setStats] = useState<StudentStats>({
    total: 0,
    active: 0,
    paused: 0,
    graduated: 0,
    trial: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadAllStudentsStats = useCallback(async () => {
    try {
      setLoading(true);
      // 모든 학생 가져오기 (필터 없이)
      const [allStudents, trialStudents] = await Promise.all([
        studentsAPI.getStudents({ is_trial: false }, { suppressErrorToast: true }),
        studentsAPI.getStudents({ is_trial: true }, { suppressErrorToast: true }),
      ]);

      const students = allStudents.students || [];
      const trials = trialStudents.students || [];

      const active = students.filter((s) => s.status === 'active').length;
      const paused = students.filter((s) => s.status === 'paused').length;
      const graduated = students.filter((s) => s.status === 'graduated').length;
      const pending = students.filter((s) => s.status === 'pending').length;

      const newStats = {
        // 전체 = 재원 + 휴원 (졸업생, 퇴원생, 체험생, 미등록 제외)
        total: active + paused,
        active,
        paused,
        graduated,
        trial: trials.length,
        pending,
      };

      setStats(newStats);
      onStatsLoaded?.(newStats);
    } catch {
      console.warn('학생 통계를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [onStatsLoaded]);

  useEffect(() => {
    loadAllStudentsStats();
  }, [loadAllStudentsStats, refreshTrigger]);

  const cards = [
    {
      title: '전체 학생',
      value: stats.total,
      icon: Users,
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: '재원',
      value: stats.active,
      icon: UserCheck,
      bgColor: 'bg-green-100 dark:bg-green-900',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: '휴원',
      value: stats.paused,
      icon: UserX,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
    {
      title: '졸업',
      value: stats.graduated,
      icon: GraduationCap,
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: '체험',
      value: stats.trial,
      icon: Sparkles,
      bgColor: 'bg-pink-100 dark:bg-pink-900',
      iconColor: 'text-pink-600 dark:text-pink-400',
    },
    {
      title: '미등록',
      value: stats.pending,
      icon: Clock,
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="overflow-x-auto pb-1 md:overflow-visible md:pb-0">
      <div className="flex w-max gap-3 md:grid md:w-full md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="w-36 shrink-0 md:w-auto md:min-w-0 md:shrink">
            <CardContent className="p-3 lg:p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`shrink-0 p-2 ${card.bgColor} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs text-muted-foreground">{card.title}</div>
                  <div className="text-xl font-bold text-foreground">
                    {loading ? '-' : card.value}명
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
}
