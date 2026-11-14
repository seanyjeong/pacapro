/**
 * Student Stats Cards Component
 * 학생 통계 카드 컴포넌트 - 전체 학생 현황 (탭과 무관하게 고정)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatTile, type Tone } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';
import { studentsAPI } from '@/lib/api/students';

type StatKey = 'active' | 'paused' | 'graduated' | 'trial' | 'pending';

interface StudentStatsCardsProps {
  onStatsLoaded?: (stats: StudentStats) => void;
  refreshTrigger?: number; // 이 값이 변경될 때마다 리로드
  /** 누르면 그 상태 목록으로 바꾼다(학생 목록 화면). */
  activeKey?: string;
  onSelect?: (key: StatKey) => void;
}

interface StudentStats {
  total: number;
  active: number;
  paused: number;
  graduated: number;
  trial: number;
  pending: number;
}

export function StudentStatsCards({ onStatsLoaded, refreshTrigger, activeKey, onSelect }: StudentStatsCardsProps) {
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

  const cards: { title: string; value: number; tone: Tone; key?: StatKey; ariaLabel?: string }[] = [
    { title: '전체 학생', value: stats.total, tone: 'neutral' },
    { title: '재원', value: stats.active, tone: 'success', key: 'active', ariaLabel: '재원 학생 보기' },
    { title: '휴원', value: stats.paused, tone: 'warning', key: 'paused', ariaLabel: '휴원 학생 보기' },
    { title: '졸업', value: stats.graduated, tone: 'primary', key: 'graduated', ariaLabel: '졸업 학생 보기' },
    { title: '체험', value: stats.trial, tone: 'primary', key: 'trial', ariaLabel: '체험 학생 보기' },
    { title: '미등록', value: stats.pending, tone: 'warning', key: 'pending', ariaLabel: '미등록 학생 보기' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
      {cards.map((card) => {
        const selectable = Boolean(onSelect && card.key);
        const active = selectable && activeKey === card.key;
        const tile = (
          <StatTile
            label={card.title}
            value={loading ? '-' : <>{card.value}<span className="ml-0.5 text-base font-bold text-muted-foreground">명</span></>}
            tone={card.tone}
            className={cn('h-full p-4 sm:p-5', active && 'ring-2 ring-inset ring-primary/40')}
          />
        );
        if (!selectable || !card.key) return <div key={card.title}>{tile}</div>;
        const key = card.key;
        return (
          <button
            key={card.title}
            type="button"
            aria-label={card.ariaLabel}
            aria-pressed={active}
            onClick={() => onSelect?.(key)}
            className="rounded-2xl text-left transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.99]"
          >
            {tile}
          </button>
        );
      })}
    </div>
  );
}
