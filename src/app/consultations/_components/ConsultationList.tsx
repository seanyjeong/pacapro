'use client';

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, Clock, Phone, Eye, Edit, Trash2, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { CONSULTATION_TYPE_LABELS, CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS } from '@/lib/types/consultation';

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Props {
  consultations: Consultation[];
  loading: boolean;
  pagination: PaginationState;
  setPagination: (p: PaginationState) => void;
  onOpenDetail: (c: Consultation) => void;
  onOpenStatusModal: (c: Consultation) => void;
  onOpenDeleteModal: (c: Consultation) => void;
}

function StatusBadge({ status }: { status: ConsultationStatus }) {
  return (
    <Badge className={CONSULTATION_STATUS_COLORS[status]}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ConsultationList({
  consultations, loading, pagination, setPagination,
  onOpenDetail, onOpenStatusModal, onOpenDeleteModal,
}: Props) {
  return (
    <>
      <Card className="rounded-md shadow-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">상담 신청이 없습니다.</div>
          ) : (
            <div className="divide-y">
              {consultations.map((c) => (
                <div
                  key={c.id}
                  className="cursor-pointer p-4 transition-colors hover:bg-muted/40"
                  onClick={() => onOpenDetail(c)}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{c.student_name}</span>
                        <span className="text-sm text-muted-foreground">{c.student_grade}</span>
                        <StatusBadge status={c.status} />
                        <Badge variant="outline">{CONSULTATION_TYPE_LABELS[c.consultation_type]}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {c.student_phone || c.parent_phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(parseISO(c.preferred_date), 'M/d (EEE)', { locale: ko })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {c.preferred_time.substring(0, 5)}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenDetail(c); }}>
                          <Eye className="h-4 w-4 mr-2" />상세 보기
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenStatusModal(c); }}>
                          <Edit className="h-4 w-4 mr-2" />상태 변경
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => { e.stopPropagation(); onOpenDeleteModal(c); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          >
            이전
          </Button>
          <span className="flex items-center px-4">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          >
            다음
          </Button>
        </div>
      )}
    </>
  );
}
