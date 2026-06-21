import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  Edit,
  Eye,
  GraduationCap,
  MoreHorizontal,
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
    <div
      className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
      onClick={() => onOpenDetail(consultation)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <GraduationCap className="h-4 w-4 text-blue-600" />
            <span className="font-medium">{consultation.student_name}</span>
            <Badge variant="outline">{consultation.student_grade}</Badge>
            {consultation.learning_type && (
              <Badge variant="secondary">{LEARNING_TYPE_LABELS[consultation.learning_type]}</Badge>
            )}
            <Badge className={CONSULTATION_STATUS_COLORS[consultation.status]}>
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
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetail(consultation);
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              상세보기
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                onOpenStatus(consultation);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              상태변경
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={(event) => {
                event.stopPropagation();
                onOpenDelete(consultation);
              }}
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
