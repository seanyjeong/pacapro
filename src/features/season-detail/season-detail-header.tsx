import Link from 'next/link';
import { Edit2, Trash2, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { SeasonPageHeader } from '@/features/seasons/season-page-header';
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
    <SeasonPageHeader
      backLabel="목록"
      title={season.season_name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {new Date(season.season_start_date).getFullYear()}년 시즌
          <SeasonStatusBadge label={SEASON_TYPE_LABELS[season.season_type]} tone="info" />
          <SeasonStatusBadge status={season.status} />
        </span>
      }
      actions={
        <>
          <Link
            aria-label={`${season.season_name} 학생 등록`}
            className={buttonVariants()}
            href={addStudentHref}
          >
            <UserPlus className="h-4 w-4" />
            학생 등록
          </Link>
          <Button type="button" variant="outline" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
            수정
          </Button>
          <Button className="text-destructive hover:text-destructive" type="button" variant="outline" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            삭제
          </Button>
        </>
      }
      onBack={onBack}
    />
  );
}
