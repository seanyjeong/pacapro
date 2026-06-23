import Link from 'next/link';
import { ArrowLeft, Edit2, Trash2, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Season } from '@/lib/types/season';
import { SEASON_TYPE_LABELS } from '@/lib/types/season';
import { SeasonStatusBadge } from './season-status-badge';

interface SeasonDetailHeaderProps {
  addStudentHref: string;
  season: Season;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SeasonDetailHeader({
  addStudentHref,
  season,
  onBack,
  onEdit,
  onDelete,
}: SeasonDetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <Button className="w-fit" size="sm" type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록
        </Button>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Season Detail</div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-normal text-foreground">{season.season_name}</h1>
            <SeasonStatusBadge label={SEASON_TYPE_LABELS[season.season_type]} tone="info" />
            <SeasonStatusBadge status={season.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{new Date(season.season_start_date).getFullYear()}년 시즌</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          aria-label={`${season.season_name} 학생 등록`}
          className={buttonVariants({ className: 'gap-2' })}
          href={addStudentHref}
        >
          <UserPlus className="h-4 w-4" />
          학생 등록
        </Link>
        <Button type="button" variant="outline" onClick={onEdit}>
          <Edit2 className="mr-2 h-4 w-4" />
          수정
        </Button>
        <Button className="text-rose-700 hover:text-rose-800" type="button" variant="outline" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          삭제
        </Button>
      </div>
    </header>
  );
}
