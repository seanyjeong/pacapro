import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  Edit,
  Eye,
  GraduationCap,
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
import { cn } from '@/lib/utils/cn';

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
    <div className="p-4 transition-colors hover:bg-muted/35">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onOpenDetail(consultation)}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/45 dark:text-sky-300">
                <GraduationCap className="h-4 w-4" />
              </span>
              <span className="font-semibold text-foreground">{consultation.student_name}</span>
              <Badge variant="outline">{consultation.student_grade}</Badge>
              {consultation.learning_type && (
                <Badge variant="secondary">{LEARNING_TYPE_LABELS[consultation.learning_type]}</Badge>
              )}
              <Badge className={cn('border-0', CONSULTATION_STATUS_COLORS[consultation.status])}>
                {CONSULTATION_STATUS_LABELS[consultation.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(parseISO(consultation.preferred_date), 'M월 d일 (EEE)', { locale: ko })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {consultation.preferred_time?.slice(0, 5)}
              </span>
              {consultation.student_school ? (
                <span className="flex items-center gap-1">
                  <School className="h-3.5 w-3.5" />
                  {consultation.student_school}
                </span>
              ) : null}
            </div>
            {consultation.admin_notes ? (
              <p className="line-clamp-2 max-w-2xl text-sm text-muted-foreground">{consultation.admin_notes}</p>
            ) : null}
          </div>
        </button>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenStatus(consultation)}
          >
            <Edit className="mr-2 h-4 w-4" />
            상태 변경
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
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
                className="text-red-600"
                onClick={() => onOpenDelete(consultation)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
