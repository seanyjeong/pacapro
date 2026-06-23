'use client';
// Phase 4 #3 (ADR-018) — 상담 목록 + 월별 그룹 섹션

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertCircle, Calendar, Clock, Phone, Eye, Edit, Trash2,
  MoreHorizontal, Loader2, ChevronDown, ChevronRight, User,
  UserCheck, UserX, Dumbbell, CheckSquare, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import type { Consultation } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS
} from '@/lib/types/consultation';
import type { GroupedMonth } from '../_types';

interface ConsultationListSectionProps {
  loading: boolean;
  errorMessage: string | null;
  statusFilter: string;
  completedTab: 'all' | 'registered' | 'trial_ongoing' | 'unregistered';
  groupedByMonth: GroupedMonth[];
  isMonthExpanded: (monthKey: string) => boolean;
  toggleMonth: (monthKey: string) => void;
  onRetry: () => void;
  onSelect: (c: Consultation) => void;
  onStatusModal: (c: Consultation) => void;
  onEditStudent: (c: Consultation) => void;
  onTrialModal: (c: Consultation) => void;
  onDeleteModal: (c: Consultation) => void;
}

export function ConsultationListSection({
  loading,
  errorMessage,
  statusFilter,
  completedTab,
  groupedByMonth,
  isMonthExpanded,
  toggleMonth,
  onRetry,
  onSelect,
  onStatusModal,
  onEditStudent,
  onTrialModal,
  onDeleteModal,
}: ConsultationListSectionProps) {
  const filteredCount = groupedByMonth.reduce((acc, g) => acc + g.consultations.length, 0);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : errorMessage ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-rose-50 text-rose-700">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{errorMessage}</p>
              <p className="text-xs text-muted-foreground">잠시 뒤 다시 시도하거나 상담 설정 상태를 확인해주세요.</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 불러오기
            </Button>
          </div>
        ) : filteredCount === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {statusFilter === 'completed' && completedTab !== 'all'
              ? (completedTab === 'registered'
                  ? '등록된 상담이 없습니다.'
                  : completedTab === 'trial_ongoing'
                    ? '체험중인 상담이 없습니다.'
                    : '미등록 상담이 없습니다.')
              : '상담 내역이 없습니다.'}
          </div>
        ) : (
          <div>
            {groupedByMonth.map((group) => (
              <div key={group.key}>
                {/* 월별 헤더 */}
                <div
                  className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => toggleMonth(group.key)}
                >
                  <div className="flex items-center gap-2">
                    {isMonthExpanded(group.key) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{group.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {group.consultations.length}명
                  </Badge>
                </div>
                {isMonthExpanded(group.key) && (
                  <div className="divide-y">
                    {group.consultations.map((c) => (
                      <ConsultationRow
                        key={c.id}
                        consultation={c}
                        onSelect={onSelect}
                        onStatusModal={onStatusModal}
                        onEditStudent={onEditStudent}
                        onTrialModal={onTrialModal}
                        onDeleteModal={onDeleteModal}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ConsultationRowProps {
  consultation: Consultation;
  onSelect: (c: Consultation) => void;
  onStatusModal: (c: Consultation) => void;
  onEditStudent: (c: Consultation) => void;
  onTrialModal: (c: Consultation) => void;
  onDeleteModal: (c: Consultation) => void;
}

function ConsultationRow({
  consultation: c,
  onSelect,
  onStatusModal,
  onEditStudent,
  onTrialModal,
  onDeleteModal,
}: ConsultationRowProps) {
  return (
    <div
      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onSelect(c)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{c.student_name}</span>
            <Badge variant="outline">{c.student_grade}</Badge>
            <Badge className={CONSULTATION_STATUS_COLORS[c.status]}>
              {CONSULTATION_STATUS_LABELS[c.status]}
            </Badge>
            {c.status === 'completed' && (
              <>
                {(c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'trial_completed') && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" />
                    체험완료
                  </Badge>
                )}
                {(c.matched_student_status === 'registered_with_trial' || c.matched_student_status === 'registered_direct') && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    등록
                  </Badge>
                )}
                {c.matched_student_status === 'trial_ongoing' && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" />
                    체험중
                  </Badge>
                )}
                {(c.matched_student_status === 'trial_completed' || c.matched_student_status === 'no_trial' || !c.matched_student_status) && (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800 flex items-center gap-1">
                    <UserX className="h-3 w-3" />
                    미등록
                  </Badge>
                )}
                {c.matched_student_status === 'no_trial' && (
                  <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 flex items-center gap-1">
                    미체험
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(parseISO(c.preferred_date), 'M월 d일 (EEE)', { locale: ko })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {c.preferred_time?.slice(0, 5)}
            </span>
            {c.parent_phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {c.parent_phone}
              </span>
            )}
          </div>
          {c.admin_notes && (
            <div className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded mt-1">
              <span className="font-medium">메모:</span> {c.admin_notes}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(c); }}>
              <Eye className="h-4 w-4 mr-2" />
              상세보기
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusModal(c); }}>
              <Edit className="h-4 w-4 mr-2" />
              상태변경
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditStudent(c); }}>
              <User className="h-4 w-4 mr-2" />
              학생정보 수정
            </DropdownMenuItem>
            {c.status === 'completed' && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTrialModal(c); }}>
                <CheckSquare className="h-4 w-4 mr-2" />
                체험등록
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={(e) => { e.stopPropagation(); onDeleteModal(c); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
