/**
 * Instructor Stats Cards Component
 * 강사 통계 카드 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, UserX, UserMinus } from 'lucide-react';
import type { Instructor } from '@/lib/types/instructor';

interface InstructorStatsCardsProps {
  instructors: Instructor[];
}

export function InstructorStatsCards({ instructors }: InstructorStatsCardsProps) {
  const stats = {
    total: instructors.length,
    active: instructors.filter((i) => i.status === 'active').length,
    on_leave: instructors.filter((i) => i.status === 'on_leave').length,
    retired: instructors.filter((i) => i.status === 'retired').length,
  };

  const cards = [
    {
      title: '전체 강사',
      value: stats.total,
      icon: Users,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: '재직',
      value: stats.active,
      icon: UserCheck,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      title: '휴직',
      value: stats.on_leave,
      icon: UserX,
      bgColor: 'bg-gray-100',
      iconColor: 'text-gray-600',
    },
    {
      title: '퇴사',
      value: stats.retired,
      icon: UserMinus,
      bgColor: 'bg-red-100',
      iconColor: 'text-red-600',
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
