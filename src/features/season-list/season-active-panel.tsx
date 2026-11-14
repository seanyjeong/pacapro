import Link from 'next/link';
import { CalendarDays, Edit2, FileText, UserPlus, WalletCards } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { Season, TimeSlot } from '@/lib/types/season';
import { formatOperatingDays, formatSeasonFee, parseOperatingDays, TIME_SLOT_LABELS } from '@/lib/types/season';
import { cn } from '@/lib/utils';
import { SeasonStatusBadge } from './season-status-badge';
import { SeasonTypeBadge } from './season-type-badge';
import { formatDateRange, selectPrimarySeason } from './season-list-utils';

interface SeasonActivePanelProps {
  seasons: Season[];
}

export function SeasonActivePanel({ seasons }: SeasonActivePanelProps) {
  const season = selectPrimarySeason(seasons);
  if (!season) return null;

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6" data-testid="season-active-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">대표 시즌</span>
            <SeasonTypeBadge type={season.season_type} />
            <SeasonStatusBadge status={season.status} />
          </div>
          <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-foreground">{season.season_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateRange(season.season_start_date, season.season_end_date)}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex lg:flex-nowrap">
          <Link
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1 whitespace-nowrap')}
            href={`/seasons/${season.id}`}
            aria-label={`${season.season_name} 상세`}
          >
            <FileText className="h-4 w-4" />
            상세
          </Link>
          <Link
            className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 gap-1 whitespace-nowrap')}
            href={`/seasons/${season.id}/enroll`}
            aria-label={`${season.season_name} 학생 등록`}
          >
            <UserPlus className="h-4 w-4" />
            학생 등록
          </Link>
          <Link
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1 whitespace-nowrap')}
            href={`/seasons/${season.id}/edit`}
            aria-label={`${season.season_name} 수정`}
          >
            <Edit2 className="h-4 w-4" />
            수정
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <SeasonFact icon={CalendarDays} label="운영 요일" value={formatOperatingDays(parseOperatingDays(season.operating_days)) || '미설정'} />
        <SeasonFact icon={WalletCards} label="기본 시즌비" value={formatSeasonFee(season.default_season_fee)} />
        <SeasonFact icon={UserPlus} label="학년별 시간대" value={formatGradeTimeSlots(season)} />
      </div>
    </section>
  );
}

function SeasonFact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3.5">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{value}</p>
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
