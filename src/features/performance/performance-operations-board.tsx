'use client';

import type { ReactNode } from 'react';
import { Award, CheckCircle2, Clock, GraduationCap, RefreshCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PerformanceJungsiLinkButton } from './performance-jungsi-link-button';
import type { JungsiStatus, PerformanceStudent, PerformanceStudentStatusFilter } from './performance-types';
import { EXAM_TYPES, getBranchLabel, getJungsiStatusLabel, isJungsiLinked } from './performance-utils';

interface PerformanceOperationsBoardProps {
  status: JungsiStatus | null;
  statusError: string | null;
  statusLoading: boolean;
  students: PerformanceStudent[];
  studentsError: string | null;
  studentsLoading: boolean;
  studentStatusFilter: PerformanceStudentStatusFilter;
  onOpenMockExam: () => void;
  onRefreshStatus: () => void;
  onRefreshStudents: () => void;
  onStudentStatusFilterChange: (filter: PerformanceStudentStatusFilter) => void;
}

export function PerformanceOperationsBoard({
  status,
  statusError,
  statusLoading,
  students,
  studentsError,
  studentsLoading,
  studentStatusFilter,
  onOpenMockExam,
  onRefreshStatus,
  onRefreshStudents,
  onStudentStatusFilterChange,
}: PerformanceOperationsBoardProps) {
  const activeCount = students.filter((student) => student.status === 'active').length;
  const pausedCount = students.filter((student) => student.status === 'paused').length;
  const examCount = status?.examTypes?.length || EXAM_TYPES.length;
  const linked = isJungsiLinked(status);
  const statusLabel = getJungsiStatusLabel(status, statusError, statusLoading);

  return (
    <aside
      aria-label="성적 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="performance-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Performance Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">성적 작업 보드</h2>
        <p className="text-sm text-slate-600">정시엔진 상태와 조회 대상 학생을 먼저 확인합니다.</p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-start gap-2">
          <Server className="mt-0.5 h-4 w-4 text-slate-500" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">정시엔진</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{statusLabel}</p>
            <p className="mt-1 text-xs text-slate-600">{getBranchLabel(status?.branchName ?? null, linked)}</p>
          </div>
        </div>
      </div>

      <PerformanceJungsiLinkButton status={status} onRefresh={onRefreshStatus} />

      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<GraduationCap className="h-4 w-4" />}
          label="재원 학생"
          loading={studentsLoading}
          selected={studentStatusFilter === 'active'}
          testId="performance-metric-active"
          value={`${activeCount}명`}
          onClick={() => onStudentStatusFilterChange('active')}
        />
        <Metric
          icon={<Clock className="h-4 w-4" />}
          label="휴원 학생"
          loading={studentsLoading}
          selected={studentStatusFilter === 'paused'}
          testId="performance-metric-paused"
          value={`${pausedCount}명`}
          onClick={() => onStudentStatusFilterChange('paused')}
        />
        <Metric
          icon={<Award className="h-4 w-4" />}
          label="시험 종류"
          loading={statusLoading}
          testId="performance-metric-exams"
          value={`${examCount}종`}
        />
        <Metric
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="전체 조회"
          loading={studentsLoading}
          selected={studentStatusFilter === 'all'}
          testId="performance-metric-ready"
          value={studentsError ? '확인' : `${students.length}명`}
          onClick={() => onStudentStatusFilterChange('all')}
        />
      </div>

      <div className="grid gap-2">
        <Button className="w-full justify-start gap-2" type="button" onClick={onOpenMockExam}>
          <Award className="h-4 w-4" />
          모의고사·수능 보기
        </Button>
        <Button className="w-full justify-start gap-2" type="button" variant="outline" onClick={onRefreshStudents}>
          <RefreshCw className="h-4 w-4" />
          학생 목록 새로고침
        </Button>
        <Button className="w-full justify-start gap-2" type="button" variant="ghost" onClick={onRefreshStatus}>
          <Server className="h-4 w-4" />
          엔진 상태 확인
        </Button>
      </div>
    </aside>
  );
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  loading: boolean;
  selected?: boolean;
  testId: string;
  value: string;
  onClick?: () => void;
}

function Metric({ icon, label, loading, selected = false, testId, value, onClick }: MetricProps) {
  const className = cn(
    'rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition',
    onClick && 'hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900',
    selected && 'border-blue-300 bg-blue-50 text-blue-950'
  );
  const content = (
    <>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{loading ? '-' : value}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        aria-pressed={selected}
        className={className}
        data-testid={testId}
        disabled={loading}
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  );
}
