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
      bgColor: 'bg-slate-100 dark:bg-slate-900/60',
      iconColor: 'text-slate-700 dark:text-slate-200',
    },
    {
      title: '재직',
      value: stats.active,
      icon: UserCheck,
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
      iconColor: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      title: '휴직',
      value: stats.on_leave,
      icon: UserX,
      bgColor: 'bg-muted',
      iconColor: 'text-muted-foreground',
    },
    {
      title: '퇴사',
      value: stats.retired,
      icon: UserMinus,
      bgColor: 'bg-rose-100 dark:bg-rose-900/50',
      iconColor: 'text-rose-700 dark:text-rose-300',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="rounded-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-md p-2.5 ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">{card.title}</div>
                  <div className="mt-1 text-xl font-semibold tracking-normal text-foreground">{card.value}명</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
