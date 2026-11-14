import { AlertCircle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { JungsiStatus, PerformanceStudent, StudentAllScores } from './performance-types';
import { PerformanceErrorPanel } from './performance-error-panel';
import { PerformanceStudentList } from './performance-student-list';
import { getBranchLabel, isJungsiLinked, isJungsiReady } from './performance-utils';

interface MockExamPanelProps {
  expandedStudentId: number | null;
  jungsiStatus: JungsiStatus | null;
  scores: StudentAllScores | null;
  scoresError: string | null;
  scoresLoading: boolean;
  searchQuery: string;
  statusError: string | null;
  students: PerformanceStudent[];
  studentsError: string | null;
  studentsLoading: boolean;
  onRefreshStatus: () => void;
  onRefreshStudents: () => void;
  onSearchChange: (value: string) => void;
  onStudentToggle: (studentId: number) => void;
}

export function MockExamPanel({
  expandedStudentId,
  jungsiStatus,
  scores,
  scoresError,
  scoresLoading,
  searchQuery,
  statusError,
  students,
  studentsError,
  studentsLoading,
  onRefreshStatus,
  onRefreshStudents,
  onSearchChange,
  onStudentToggle,
}: MockExamPanelProps) {
  const linked = isJungsiLinked(jungsiStatus);
  const ready = isJungsiReady(jungsiStatus, statusError);

  if (statusError) {
    return <PerformanceErrorPanel message={statusError} title="정시엔진 정보를 확인하지 못했습니다" onRetry={onRefreshStatus} />;
  }

  if (!linked) {
    return (
      <PerformanceErrorPanel
        message="이 학원은 아직 정시엔진과 연동되지 않았습니다. 관리자에게 문의해주세요."
        title="정시엔진 연동이 필요합니다"
        onRetry={onRefreshStatus}
      />
    );
  }

  if (!ready) {
    return (
      <PerformanceErrorPanel
        message="정시엔진과 연결할 수 없습니다. 잠시 후 다시 시도해주세요."
        title="정시엔진 연결을 확인해주세요"
        onRetry={onRefreshStatus}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-card">
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-4 sm:px-5" role="search" aria-label="성적 학생 검색">
          <label className="relative block min-w-0 basis-full sm:basis-auto sm:flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="학생 이름, 학교, 학년 검색"
              className="pl-10"
              placeholder="학생 이름, 학교, 학년"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <Badge variant="success" className="h-8 gap-1 px-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {getBranchLabel(jungsiStatus?.branchName ?? null, linked)}
          </Badge>
          <Button variant="ghost" className="ml-auto shrink-0 px-3" onClick={onRefreshStudents}>
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
        </div>

        {studentsError ? (
          <div className="p-4 sm:p-5">
            <PerformanceErrorPanel message={studentsError} title="학생 목록을 불러오지 못했습니다" onRetry={onRefreshStudents} />
          </div>
        ) : (
          <PerformanceStudentList
            expandedStudentId={expandedStudentId}
            scores={scores}
            scoresError={scoresError}
            scoresLoading={scoresLoading}
            students={students}
            studentsLoading={studentsLoading}
            onStudentToggle={onStudentToggle}
          />
        )}
      </section>

      <p className="flex gap-2 px-1 text-[13px] text-muted-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="break-keep">학생을 펼치면 3월, 6월, 9월, 수능 성적을 한 번에 조회해요.</span>
      </p>
    </div>
  );
}
