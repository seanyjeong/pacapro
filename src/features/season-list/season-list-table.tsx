import Link from 'next/link';
import { Edit2, FileText, Trash2, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Season } from '@/lib/types/season';
import { formatOperatingDays, formatSeasonFee, parseOperatingDays } from '@/lib/types/season';
import { cn } from '@/lib/utils';
import { SeasonStatusBadge } from './season-status-badge';
import { SeasonTypeBadge } from './season-type-badge';
import { formatDateRange } from './season-list-utils';

interface SeasonListTableProps {
  seasons: Season[];
  onDelete: (seasonId: number, seasonName: string) => void;
  onOpen: (seasonId: number) => void;
}

type SeasonRowProps = Omit<SeasonListTableProps, 'seasons'> & {
  season: Season;
};

export function SeasonListTable({ seasons, onDelete, onOpen }: SeasonListTableProps) {
  return (
    <>
      <div className="px-4 pt-4 sm:px-5">
        <h2 className="text-[15px] font-bold text-foreground">시즌 목록 <span className="text-muted-foreground tabular-nums">{seasons.length}개</span></h2>
      </div>
      <div className="hidden overflow-x-auto px-2 pb-2 md:block">
        <table className="w-full min-w-[1100px] table-fixed">
          <thead>
            <tr className="border-b border-border/60 text-left text-[13px] font-semibold text-muted-foreground">
              <th className="w-[190px] px-3 py-3.5">시즌명</th>
              <th className="w-[80px] px-3 py-3.5">타입</th>
              <th className="w-[200px] px-3 py-3.5">기간</th>
              <th className="w-[140px] px-3 py-3.5">운영요일</th>
              <th className="w-[120px] px-3 py-3.5">시즌비</th>
              <th className="w-[90px] px-3 py-3.5">상태</th>
              <th className="w-[300px] px-3 py-3.5 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {seasons.map((season) => (
              <SeasonListTableRow key={season.id} season={season} onDelete={onDelete} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border/60 md:hidden">
        {seasons.map((season) => (
          <SeasonListMobileRow key={season.id} season={season} onDelete={onDelete} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

function SeasonListTableRow({ season, onDelete, onOpen }: SeasonRowProps) {
  const operatingDays = parseOperatingDays(season.operating_days);
  return (
    <tr className="cursor-pointer transition-colors hover:bg-muted/60" data-testid="season-row" onClick={() => onOpen(season.id)}>
      <td className="w-[190px] px-3 py-3.5">
        <p className="truncate text-[15px] font-semibold text-foreground">{season.season_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{new Date(season.season_start_date).getFullYear()}년</p>
      </td>
      <td className="w-[80px] whitespace-nowrap px-3 py-3.5"><SeasonTypeBadge type={season.season_type} /></td>
      <td className="w-[200px] whitespace-nowrap px-3 py-3.5 text-sm text-muted-foreground">{formatDateRange(season.season_start_date, season.season_end_date)}</td>
      <td className="w-[140px] whitespace-nowrap px-3 py-3.5 text-sm text-muted-foreground">{formatOperatingDays(operatingDays)}</td>
      <td className="w-[140px] whitespace-nowrap px-3 py-3.5 text-sm font-medium text-foreground">{formatSeasonFee(season.default_season_fee)}</td>
      <td className="w-[90px] whitespace-nowrap px-3 py-3.5"><SeasonStatusBadge status={season.status} /></td>
      <td className="w-[300px] whitespace-nowrap px-3 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
        <SeasonRowActions season={season} onDelete={onDelete} />
      </td>
    </tr>
  );
}

function SeasonListMobileRow({ season, onDelete, onOpen }: SeasonRowProps) {
  return (
    <div className="space-y-3 px-4 py-4" data-testid="season-row" onClick={() => onOpen(season.id)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-foreground">{season.season_name}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{formatDateRange(season.season_start_date, season.season_end_date)}</p>
        </div>
        <SeasonStatusBadge status={season.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-secondary-foreground">
        <SeasonTypeBadge type={season.season_type} />
        <span>{formatSeasonFee(season.default_season_fee)}</span>
        <span>{formatOperatingDays(parseOperatingDays(season.operating_days))}</span>
      </div>
      <div onClick={(event) => event.stopPropagation()}>
        <SeasonRowActions season={season} onDelete={onDelete} />
      </div>
    </div>
  );
}

function SeasonRowActions({ season, onDelete }: Pick<SeasonListTableProps, 'onDelete'> & { season: Season }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 md:flex md:flex-nowrap md:justify-end">
      <Link
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1 whitespace-nowrap px-2')}
        href={`/seasons/${season.id}`}
        aria-label={`${season.season_name} 상세`}
      >
        <FileText className="h-3.5 w-3.5" />
        상세
      </Link>
      <Link
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1 whitespace-nowrap px-2')}
        href={`/seasons/${season.id}/enroll`}
        aria-label={`${season.season_name} 학생 등록`}
      >
        <UserPlus className="h-3.5 w-3.5" />
        학생 등록
      </Link>
      <Link
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0 gap-1 whitespace-nowrap px-2')}
        href={`/seasons/${season.id}/edit`}
        aria-label={`${season.season_name} 수정`}
      >
        <Edit2 className="h-3.5 w-3.5" />
        수정
      </Link>
      <Button
        aria-label="삭제"
        className="shrink-0 gap-1 whitespace-nowrap px-2 text-destructive hover:bg-destructive-soft hover:text-destructive"
        variant="ghost"
        size="sm"
        onClick={() => onDelete(season.id, season.season_name)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        삭제
      </Button>
    </div>
  );
}
