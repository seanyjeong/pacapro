'use client';

import Link from 'next/link';
import { CalendarClock, FilterX, Save, UserPlus, Users, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

interface ClassDaysOperationsBoardProps {
  changedCount: number;
  effectiveFromLabel: string;
  focusedStudentName: string | null;
  hasActiveFilters: boolean;
  resultCount: number;
  saving: boolean;
  scheduledCount: number;
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onResetFilters: () => void;
  onSave: () => void;
}

export function ClassDaysOperationsBoard({
  changedCount,
  effectiveFromLabel,
  focusedStudentName,
  hasActiveFilters,
  resultCount,
  saving,
  scheduledCount,
  selectedCount,
  totalCount,
  onClearSelection,
  onResetFilters,
  onSave,
}: ClassDaysOperationsBoardProps) {
  return (
    <aside
      aria-label="수업일 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="class-days-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Class Day Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">수업일 작업 보드</h2>
        <p className="text-sm text-slate-600">선택, 일괄 변경, 적용월을 한 번에 확인합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="전체 학생" value={`${totalCount}명`} />
        <Metric label="표시 학생" value={`${resultCount}명`} />
        <Metric label="선택 학생" value={`${selectedCount}명`} />
        <Metric label="변경 대기" value={`${changedCount}명`} />
        <Metric label="예약 변경" value={`${scheduledCount}명`} />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">적용 시작</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{effectiveFromLabel}</p>
          </div>
        </div>
        {focusedStudentName ? (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-700">
            집중 학생 {focusedStudentName}
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Button
          className="w-full justify-start gap-2"
          disabled={changedCount === 0 || saving}
          type="button"
          onClick={onSave}
        >
          <Save className="h-4 w-4" />
          {saving ? '저장 중' : '적용 내용 저장'}
        </Button>
        <Button
          className="w-full justify-start gap-2"
          disabled={selectedCount === 0}
          type="button"
          variant="outline"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
          선택 해제
        </Button>
        <Button
          className="w-full justify-start gap-2"
          disabled={!hasActiveFilters}
          type="button"
          variant="outline"
          onClick={onResetFilters}
        >
          <FilterX className="h-4 w-4" />
          필터 초기화
        </Button>
        <Link
          className={buttonVariants({ variant: 'outline', className: 'w-full justify-start gap-2' })}
          href="/students/new"
        >
          <UserPlus className="h-4 w-4" />
          학생 등록
        </Link>
        <Link
          className={buttonVariants({ variant: 'ghost', className: 'w-full justify-start gap-2' })}
          href="/students"
        >
          <Users className="h-4 w-4" />
          학생 목록
        </Link>
      </div>
    </aside>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
