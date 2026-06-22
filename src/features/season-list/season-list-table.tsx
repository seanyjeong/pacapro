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
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">시즌 목록 ({seasons.length}개)</h2>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px]">
          <thead className="bg-muted/40">
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">시즌명</th>
              <th className="px-4 py-3">타입</th>
              <th className="px-4 py-3">기간</th>
              <th className="px-4 py-3">운영요일</th>
              <th className="px-4 py-3">시즌비</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {seasons.map((season) => (
              <SeasonListTableRow key={season.id} season={season} onDelete={onDelete} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border md:hidden">
        {seasons.map((season) => (
          <SeasonListMobileRow key={season.id} season={season} onDelete={onDelete} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function SeasonListTableRow({ season, onDelete, onOpen }: SeasonRowProps) {
  const operatingDays = parseOperatingDays(season.operating_days);
  return (
    <tr className="cursor-pointer hover:bg-muted/40" data-testid="season-row" onClick={() => onOpen(season.id)}>
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{season.season_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{new Date(season.season_start_date).getFullYear()}년</p>
      </td>
      <td className="px-4 py-3"><SeasonTypeBadge type={season.season_type} /></td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateRange(season.season_start_date, season.season_end_date)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{formatOperatingDays(operatingDays)}</td>
      <td className="px-4 py-3 text-sm font-medium text-foreground">{formatSeasonFee(season.default_season_fee)}</td>
      <td className="px-4 py-3"><SeasonStatusBadge status={season.status} /></td>
      <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
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
          <p className="font-semibold text-foreground">{season.season_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateRange(season.season_start_date, season.season_end_date)}</p>
        </div>
        <SeasonStatusBadge status={season.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
    <div className="flex flex-wrap justify-end gap-2">
      <Link
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1.5 px-2')}
        href={`/seasons/${season.id}`}
        aria-label={`${season.season_name} 상세`}
      >
        <FileText className="h-3.5 w-3.5" />
        상세
      </Link>
      <Link
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1.5 px-2')}
        href={`/seasons/${season.id}/enroll`}
        aria-label={`${season.season_name} 학생 등록`}
      >
        <UserPlus className="h-3.5 w-3.5" />
        학생 등록
      </Link>
      <Link
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 gap-1.5 px-2')}
        href={`/seasons/${season.id}/edit`}
        aria-label={`${season.season_name} 수정`}
      >
        <Edit2 className="h-3.5 w-3.5" />
        수정
      </Link>
      <Button
        aria-label="삭제"
        className="h-8 gap-1.5 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
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
