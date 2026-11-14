/**
 * Instructor Stats Cards Component
 * 강사 통계 카드 컴포넌트
 */

import { StatTile, type Tone } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import type { Instructor } from '@/lib/types/instructor';

type InstructorStatKey = 'all' | 'active' | 'on_leave';

interface InstructorStatsCardsProps {
  instructors: Instructor[];
  /** 누르면 그 상태만 보기(전체는 필터 초기화) */
  activeKey?: InstructorStatKey | null;
  onSelect?: (key: InstructorStatKey) => void;
}

export function InstructorStatsCards({ instructors, activeKey, onSelect }: InstructorStatsCardsProps) {
  const stats = {
    total: instructors.length,
    active: instructors.filter((i) => i.status === 'active').length,
    on_leave: instructors.filter((i) => i.status === 'on_leave').length,
    retired: instructors.filter((i) => i.status === 'retired').length,
  };

  const cards: { title: string; value: number; tone: Tone; key?: InstructorStatKey; ariaLabel?: string }[] = [
    { title: '전체 강사', value: stats.total, tone: 'neutral', key: 'all', ariaLabel: '전체 강사 보기' },
    { title: '재직', value: stats.active, tone: 'success', key: 'active', ariaLabel: '재직 보기' },
    { title: '휴직', value: stats.on_leave, tone: 'warning', key: 'on_leave', ariaLabel: '휴직 보기' },
    { title: '퇴사', value: stats.retired, tone: 'neutral' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const pressed = Boolean(card.key && activeKey === card.key);
        const tile = (
          <StatTile
            label={card.title}
            value={<>{card.value}<span className="ml-0.5 text-base font-bold text-muted-foreground">명</span></>}
            tone={card.tone}
            className={cn('h-full', pressed && 'ring-2 ring-inset ring-primary/40')}
          />
        );
        if (!onSelect || !card.key) return <div key={card.title}>{tile}</div>;
        const key = card.key;
        return (
          <button
            key={card.title}
            type="button"
            aria-label={card.ariaLabel}
            aria-pressed={pressed}
            onClick={() => onSelect(key)}
            className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.99]"
          >
            {tile}
          </button>
        );
      })}
    </div>
  );
}
