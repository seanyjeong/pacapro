'use client';

import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, Clock, ClipboardList, Edit, Eye, Loader2, MoreHorizontal, Phone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/page';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { Branch } from '@/lib/api/branches';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { CONSULTATION_TYPE_LABELS, CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS } from '@/lib/types/consultation';

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Props {
  branches: Branch[];
  consultations: Consultation[];
  loading: boolean;
  pagination: PaginationState;
  setPagination: (p: PaginationState) => void;
  filterBar: ReactNode;
  activeFilterCount: number;
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
  branches, consultations, loading, pagination, setPagination, filterBar, activeFilterCount,
  onOpenDetail, onOpenStatusModal, onOpenDeleteModal,
}: Props) {
  const branchName = (id?: number | null) => branches.find((branch) => branch.id === id)?.name;
  return (
    <section className="rounded-2xl bg-card">
      <div className="space-y-4 px-5 pb-2 pt-5 sm:px-6">
        {filterBar}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">
            상담 목록 <span className="ml-1 font-extrabold text-primary tabular-nums">{pagination.total}</span>
          </h2>
          {activeFilterCount > 0 && <Badge variant="secondary">필터 {activeFilterCount}개 적용</Badge>}
        </div>
      </div>

      <div className="px-5 pb-3 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : consultations.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="상담 신청이 없어요"
            description="필터를 풀거나 직접 등록으로 상담을 추가해 보세요."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {consultations.map((c) => (
              <div
                key={c.id}
                className="-mx-2 flex cursor-pointer items-start gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-muted"
                onClick={() => onOpenDetail(c)}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[15px] font-semibold text-foreground">{c.student_name}</span>
                    <span className="text-sm text-muted-foreground">{c.student_grade}</span>
                    <StatusBadge status={c.status} />
                    <Badge variant="secondary">{CONSULTATION_TYPE_LABELS[c.consultation_type]}</Badge>
                    {branchName(c.branch_id) && <Badge variant="secondary">{branchName(c.branch_id)}</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-secondary-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(parseISO(c.preferred_date), 'M/d (EEE)', { locale: ko })}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-secondary-foreground tabular-nums">
                      <Clock className="h-3.5 w-3.5" />
                      {c.preferred_time.substring(0, 5)}
                    </span>
                    {(c.student_phone || c.parent_phone) && (
                      <span className="flex min-w-0 items-center gap-1 tabular-nums">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.student_phone || c.parent_phone}</span>
                      </span>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button aria-label={`${c.student_name} 상담 작업`} variant="ghost" size="icon-sm">
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
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); onOpenDeleteModal(c); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-border/60 px-5 py-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          >
            이전
          </Button>
          <span className="px-3 text-sm font-semibold text-secondary-foreground tabular-nums">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          >
            다음
          </Button>
        </div>
      )}
    </section>
  );
}
