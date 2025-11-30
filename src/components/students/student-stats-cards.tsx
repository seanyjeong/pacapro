/**
 * Student Stats Cards Component
 * 학생 통계 카드 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, UserX, GraduationCap } from 'lucide-react';
import type { Student } from '@/lib/types/student';

interface StudentStatsCardsProps {
  students: Student[];
}

export function StudentStatsCards({ students }: StudentStatsCardsProps) {
  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === 'active').length,
    paused: students.filter((s) => s.status === 'paused').length,
    graduated: students.filter((s) => s.status === 'graduated').length,
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
      bgColor: 'bg-gray-100',
      iconColor: 'text-gray-600',
    },
    {
      title: '졸업',
      value: stats.graduated,
      icon: GraduationCap,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className={`p-3 ${card.bgColor} rounded-xl`}>
                  <Icon className={`w-6 h-6 ${card.iconColor}`} />
                </div>
                <div>
                  <div className="text-sm text-gray-600">{card.title}</div>
                  <div className="text-2xl font-bold text-gray-900">{card.value}명</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
