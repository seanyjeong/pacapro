import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  Edit,
  Eye,
  MoreHorizontal,
  School,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Consultation } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_COLORS,
  CONSULTATION_STATUS_LABELS,
  LEARNING_TYPE_LABELS,
} from '@/lib/types/consultation';

interface EnrolledConsultationRowProps {
  consultation: Consultation;
  onOpenDetail: (consultation: Consultation) => void;
  onOpenStatus: (consultation: Consultation) => void;
  onOpenDelete: (consultation: Consultation) => void;
}

export function EnrolledConsultationRow({
  consultation,
  onOpenDetail,
  onOpenStatus,
  onOpenDelete,
}: EnrolledConsultationRowProps) {
  return (
    <div className="-mx-2 flex items-start gap-2 rounded-xl px-2 py-3.5 transition-colors hover:bg-muted">
      <button
        type="button"
        className="min-w-0 flex-1 space-y-1.5 text-left"
        onClick={() => onOpenDetail(consultation)}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-semibold text-foreground">{consultation.student_name}</span>
          <span className="text-sm text-muted-foreground">{consultation.student_grade}</span>
          <Badge className={CONSULTATION_STATUS_COLORS[consultation.status]}>
            {CONSULTATION_STATUS_LABELS[consultation.status]}
          </Badge>
          {consultation.learning_type && (
            <Badge variant="secondary">{LEARNING_TYPE_LABELS[consultation.learning_type]}</Badge>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-secondary-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {format(parseISO(consultation.preferred_date), 'M월 d일 (EEE)', { locale: ko })}
          </span>
          <span className="flex items-center gap-1 font-semibold text-secondary-foreground tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {consultation.preferred_time?.slice(0, 5)}
          </span>
          {consultation.student_school ? (
            <span className="flex min-w-0 items-center gap-1">
              <School className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{consultation.student_school}</span>
            </span>
          ) : null}
        </span>
        {consultation.admin_notes ? (
          <span className="block line-clamp-2 max-w-2xl text-[13px] text-muted-foreground">{consultation.admin_notes}</span>
        ) : null}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => onOpenStatus(consultation)}
        >
          <Edit className="h-4 w-4" />
          상태 변경
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`${consultation.student_name} 상담 작업`} variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenDetail(consultation)}>
              <Eye className="mr-2 h-4 w-4" />
              상세보기
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenStatus(consultation)}>
              <Edit className="mr-2 h-4 w-4" />
              상태변경
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onOpenDelete(consultation)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
