'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertCircle, Layers3, RefreshCw, RotateCcw, Users, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreditStats, CreditTypeStats, StudentWithCredit } from '@/lib/types/payment';
import { CREDIT_STATUS_OPTIONS, CREDIT_TYPE_OPTIONS } from './credits-constants';
import type { CreditFilters, CreditStatusFilter, CreditTypeFilter } from './credits-types';
import { formatWon, getCreditTypeLabel, getStudentStatusLabel } from './credits-utils';

interface CreditsOperationsBoardProps {
  filters: CreditFilters;
  loading: boolean;
  stats: CreditStats;
  students: StudentWithCredit[];
  typeStats: CreditTypeStats[];
  onReload: () => void;
  onResetFilters: () => void;
  onStatusChange: (value: CreditStatusFilter) => void;
  onTypeChange: (value: CreditTypeFilter) => void;
}

export function CreditsOperationsBoard({
  filters,
  loading,
  stats,
  students,
  typeStats,
  onReload,
  onResetFilters,
  onStatusChange,
  onTypeChange,
}: CreditsOperationsBoardProps) {
  const visibleStudents = students.slice(0, 4);
  const hiddenStudentCount = Math.max(students.length - visibleStudents.length, 0);

  return (
    <aside
      aria-label="크레딧 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="credits-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Finance Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">크레딧 작업 보드</h2>
        <p className="text-sm text-slate-600">잔여 크레딧, 대기 건, 보유 학생을 한곳에서 확인합니다.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">현재 보기</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          {getFilterLabel(CREDIT_STATUS_OPTIONS, filters.status)} · {getFilterLabel(CREDIT_TYPE_OPTIONS, filters.type)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<WalletCards className="h-4 w-4" />}
          label="잔여"
          testId="credits-metric-remaining"
          value={formatWon(stats.total_remaining)}
        />
        <Metric
          icon={<AlertCircle className="h-4 w-4" />}
          label="대기"
          testId="credits-metric-pending"
          value={formatWon(stats.pending_amount)}
        />
        <Metric icon={<Users className="h-4 w-4" />} label="보유 학생" testId="credits-metric-students" value={`${students.length}명`} />
        <Metric icon={<Layers3 className="h-4 w-4" />} label="유형" testId="credits-metric-types" value={`${typeStats.length}개`} />
      </div>

      <div className="grid gap-2">
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={() => onStatusChange('pending')}>
          <AlertCircle className="h-4 w-4" />
          대기 크레딧 보기
        </Button>
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={() => onStatusChange('partial')}>
          <WalletCards className="h-4 w-4" />
          부분적용 보기
        </Button>
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={() => onTypeChange('carryover')}>
          <Layers3 className="h-4 w-4" />
          이월 크레딧 보기
        </Button>
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={onResetFilters}>
          <RotateCcw className="h-4 w-4" />
          전체 크레딧 보기
        </Button>
        <Button className="w-full justify-start gap-2" disabled={loading} type="button" variant="ghost" onClick={onReload}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {visibleStudents.length > 0 ? (
        <div className="space-y-2" data-testid="credits-board-students">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">보유 학생</h3>
            <span className="text-xs text-slate-500">{students.length}명</span>
          </div>
          <div className="space-y-2">
            {visibleStudents.map((student) => (
              <Link
                key={student.id}
                aria-label={`${student.name} 학생 상세 보기`}
                className="block rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                href={`/students/${student.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-slate-950">{student.name}</p>
                  <span className="text-xs text-slate-500">{getStudentStatusLabel(student.student_status)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {formatWon(student.total_remaining)} · {student.credit_count}건
                </p>
              </Link>
            ))}
          </div>
          {hiddenStudentCount > 0 ? <p className="text-xs text-slate-500">외 {hiddenStudentCount}명은 표에서 확인하세요.</p> : null}
        </div>
      ) : null}

      {typeStats.length > 0 ? (
        <div className="space-y-2" data-testid="credits-board-types">
          <h3 className="text-sm font-semibold text-slate-950">유형 요약</h3>
          {typeStats.map((stat) => (
            <div key={stat.credit_type} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-950">{getCreditTypeLabel(stat.credit_type)}</p>
                <span className="text-xs text-slate-500">{stat.count}건</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                잔여 {formatWon(stat.remaining_amount)} / 총 {formatWon(stat.total_amount)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  testId: string;
  value: string;
}

function Metric({ icon, label, testId, value }: MetricProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function getFilterLabel(options: ReadonlyArray<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label || value;
}
