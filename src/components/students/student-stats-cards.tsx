/**
 * Student Stats Cards Component
 * 학생 통계 카드 컴포넌트 - 전체 학생 현황 (탭과 무관하게 고정)
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, UserX, GraduationCap, Sparkles } from 'lucide-react';
import { studentsAPI } from '@/lib/api/students';
import type { Student } from '@/lib/types/student';

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
}

export function StudentStatsCards({ onStatsLoaded, refreshTrigger }: StudentStatsCardsProps) {
  const [stats, setStats] = useState<StudentStats>({
    total: 0,
    active: 0,
    paused: 0,
    graduated: 0,
    trial: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllStudentsStats();
  }, [refreshTrigger]);

  const loadAllStudentsStats = async () => {
    try {
      setLoading(true);
      // 모든 학생 가져오기 (필터 없이)
      const [allStudents, trialStudents] = await Promise.all([
        studentsAPI.getStudents({ is_trial: false }),
        studentsAPI.getStudents({ is_trial: true }),
      ]);

      const students = allStudents.students || [];
      const trials = trialStudents.students || [];

      const active = students.filter((s) => s.status === 'active').length;
      const paused = students.filter((s) => s.status === 'paused').length;
      const graduated = students.filter((s) => s.status === 'graduated').length;

      const newStats = {
        // 전체 = 재원 + 휴원 + 졸업 (퇴원생, 체험생 제외)
        total: active + paused + graduated,
        active,
        paused,
        graduated,
        trial: trials.length,
      };

      setStats(newStats);
      onStatsLoaded?.(newStats);
    } catch (error) {
      console.error('Failed to load student stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: '전체 학생',
      value: stats.total,
      icon: Users,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: '재원',
      value: stats.active,
      icon: UserCheck,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      title: '휴원',
      value: stats.paused,
      icon: UserX,
      bgColor: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
    {
      title: '졸업',
      value: stats.graduated,
      icon: GraduationCap,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      title: '체험',
      value: stats.trial,
      icon: Sparkles,
      bgColor: 'bg-pink-100',
      iconColor: 'text-pink-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 ${card.bgColor} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <div>
                  <div className="text-xs text-gray-600">{card.title}</div>
                  <div className="text-xl font-bold text-gray-900">
                    {loading ? '-' : card.value}명
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
