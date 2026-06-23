'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, CircleCheck, FilterX, Flag, Plus, RefreshCw, Trophy, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Season, SeasonFilters } from '@/lib/types/season';
import { formatSeasonFee } from '@/lib/types/season';
import { selectPrimarySeason } from './season-list-utils';

interface SeasonListOperationsBoardProps {
  filters: SeasonFilters;
  seasons: Season[];
  stats: {
    active: number;
    early: number;
    regular: number;
    total: number;
  };
  onAddSeason: () => void;
  onClearFilters: () => void;
  onRefresh: () => void;
}

export function SeasonListOperationsBoard({
  filters,
  seasons,
  stats,
  onAddSeason,
  onClearFilters,
  onRefresh,
}: SeasonListOperationsBoardProps) {
  const primarySeason = selectPrimarySeason(seasons);
  const hasActiveFilters = Boolean(filters.year || filters.season_type || filters.status);

  return (
    <aside
      aria-label="시즌 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="season-list-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Season Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">시즌 작업 보드</h2>
        <p className="text-sm text-slate-600">시즌 등록, 학생 배정, 필터 상태를 한곳에서 정리합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<CalendarDays className="h-4 w-4" />} label="전체 시즌" testId="season-list-metric-total" value={`${stats.total}개`} />
        <Metric icon={<CircleCheck className="h-4 w-4" />} label="진행 중" testId="season-list-metric-active" value={`${stats.active}개`} />
        <Metric icon={<Trophy className="h-4 w-4" />} label="정시 시즌" testId="season-list-metric-regular" value={`${stats.regular}개`} />
        <Metric icon={<Flag className="h-4 w-4" />} label="수시 시즌" testId="season-list-metric-early" value={`${stats.early}개`} />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">대표 시즌</p>
        {primarySeason ? (
          <div className="mt-2 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{primarySeason.season_name}</p>
            <p className="mt-1 text-xs text-slate-600">기본 시즌비 {formatSeasonFee(primarySeason.default_season_fee)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">등록된 시즌이 없습니다.</p>
        )}
      </div>

      <div className="grid gap-2">
        <Button className="w-full justify-start gap-2" type="button" onClick={onAddSeason}>
          <Plus className="h-4 w-4" />
          새 시즌 등록
        </Button>
        {primarySeason ? (
          <>
            <Link
              aria-label={`${primarySeason.season_name} 학생 등록`}
              className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2' })}
              href={`/seasons/${primarySeason.id}/enroll`}
            >
              <UserPlus className="h-4 w-4" />
              대표 시즌 학생 등록
            </Link>
            <Link
              aria-label={`${primarySeason.season_name} 상세`}
              className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2' })}
              href={`/seasons/${primarySeason.id}`}
            >
              <CalendarDays className="h-4 w-4" />
              대표 시즌 상세
            </Link>
          </>
        ) : null}
        <Button className="w-full justify-start gap-2" disabled={!hasActiveFilters} type="button" variant="outline" onClick={onClearFilters}>
          <FilterX className="h-4 w-4" />
          필터 초기화
        </Button>
        <Button className="w-full justify-start gap-2" type="button" variant="ghost" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
      </div>
    </aside>
  );
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  testId: string;
  value: string;
}

function Metric({ icon, label, testId, value }: MetricProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
