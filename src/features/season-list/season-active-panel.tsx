import Link from 'next/link';
import { CalendarDays, Edit2, FileText, UserPlus, WalletCards } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Season, TimeSlot } from '@/lib/types/season';
import { formatOperatingDays, formatSeasonFee, parseOperatingDays, TIME_SLOT_LABELS } from '@/lib/types/season';
import { cn } from '@/lib/utils';
import { SeasonStatusBadge } from './season-status-badge';
import { SeasonTypeBadge } from './season-type-badge';
import { formatDateRange, selectPrimarySeason } from './season-list-utils';

interface SeasonActivePanelProps {
  seasons: Season[];
  onRefresh: () => void;
}

export function SeasonActivePanel({ seasons, onRefresh }: SeasonActivePanelProps) {
  const season = selectPrimarySeason(seasons);
  if (!season) return null;

  return (
    <section className="rounded-md border border-slate-200 bg-card px-4 py-4 shadow-sm" data-testid="season-active-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">진행 중 시즌</span>
            <SeasonTypeBadge type={season.season_type} />
            <SeasonStatusBadge status={season.status} />
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">{season.season_name}</h2>
          <p className="mt-1 text-sm text-slate-500">{formatDateRange(season.season_start_date, season.season_end_date)}</p>
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-nowrap">
          <Link
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1.5 whitespace-nowrap')}
            href={`/seasons/${season.id}`}
            aria-label={`${season.season_name} 상세`}
          >
            <FileText className="h-4 w-4" />
            상세
          </Link>
          <Link
            className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 gap-1.5 whitespace-nowrap')}
            href={`/seasons/${season.id}/enroll`}
            aria-label={`${season.season_name} 학생 등록`}
          >
            <UserPlus className="h-4 w-4" />
            학생 등록
          </Link>
          <Link
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1.5 whitespace-nowrap')}
            href={`/seasons/${season.id}/edit`}
            aria-label={`${season.season_name} 수정`}
          >
            <Edit2 className="h-4 w-4" />
            수정
          </Link>
          <Button className="shrink-0 whitespace-nowrap" size="sm" variant="ghost" onClick={onRefresh}>
            새로고침
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SeasonFact icon={CalendarDays} label="운영 요일" value={formatOperatingDays(parseOperatingDays(season.operating_days)) || '미설정'} />
        <SeasonFact icon={WalletCards} label="기본 시즌비" value={formatSeasonFee(season.default_season_fee)} />
        <SeasonFact icon={UserPlus} label="학년별 시간대" value={formatGradeTimeSlots(season)} />
      </div>
    </section>
  );
}

function SeasonFact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function formatGradeTimeSlots(season: Season): string {
  const gradeTimeSlots = readGradeTimeSlots(season.grade_time_slots);
  if (!gradeTimeSlots) return '미설정';

  const labels = Object.entries(gradeTimeSlots)
    .flatMap(([grade, slots]) => {
      const slotList = slots ?? [];
      if (slotList.length === 0) return [];
      return `${grade} ${slotList.map((slot) => TIME_SLOT_LABELS[slot]).join('/')}`;
    });

  return labels.length > 0 ? labels.join(' · ') : '미설정';
}

function readGradeTimeSlots(value: Season['grade_time_slots']): Partial<Record<string, TimeSlot[]>> | null {
  if (!value) return null;
  if (typeof value !== 'string') return value;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<string, TimeSlot[]>>) : null;
  } catch {
    return null;
  }
}
