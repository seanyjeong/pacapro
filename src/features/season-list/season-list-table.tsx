import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Season } from '@/lib/types/season';
import { formatOperatingDays, formatSeasonFee, parseOperatingDays } from '@/lib/types/season';
import { SeasonStatusBadge } from './season-status-badge';
import { SeasonTypeBadge } from './season-type-badge';
import { formatDateRange } from './season-list-utils';

interface SeasonListTableProps {
  seasons: Season[];
  onDelete: (seasonId: number, seasonName: string) => void;
  onEdit: (seasonId: number) => void;
  onOpen: (seasonId: number) => void;
}

type SeasonRowProps = Omit<SeasonListTableProps, 'seasons'> & {
  season: Season;
};

export function SeasonListTable({ seasons, onDelete, onEdit, onOpen }: SeasonListTableProps) {
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
              <SeasonListTableRow key={season.id} season={season} onDelete={onDelete} onEdit={onEdit} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border md:hidden">
        {seasons.map((season) => (
          <SeasonListMobileRow key={season.id} season={season} onDelete={onDelete} onEdit={onEdit} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function SeasonListTableRow({ season, onDelete, onEdit, onOpen }: SeasonRowProps) {
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
        <SeasonRowActions season={season} onDelete={onDelete} onEdit={onEdit} />
      </td>
    </tr>
  );
}

function SeasonListMobileRow({ season, onDelete, onEdit, onOpen }: SeasonRowProps) {
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
        <SeasonRowActions season={season} onDelete={onDelete} onEdit={onEdit} />
      </div>
    </div>
  );
}

function SeasonRowActions({ season, onDelete, onEdit }: Pick<SeasonListTableProps, 'onDelete' | 'onEdit'> & { season: Season }) {
  return (
    <div className="flex justify-end gap-1">
      <Button aria-label="수정" variant="ghost" size="sm" onClick={() => onEdit(season.id)}>
        <Edit2 className="h-4 w-4" />
      </Button>
      <Button aria-label="삭제" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" variant="ghost" size="sm" onClick={() => onDelete(season.id, season.season_name)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
