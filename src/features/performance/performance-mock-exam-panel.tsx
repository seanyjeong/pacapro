import { AlertCircle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { JungsiStatus, PerformanceStudent, StudentAllScores } from './performance-types';
import { PerformanceErrorPanel } from './performance-error-panel';
import { PerformanceStudentList } from './performance-student-list';
import { getBranchLabel } from './performance-utils';

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
  if (statusError) return <PerformanceErrorPanel message={statusError} onRetry={onRefreshStatus} />;

  if (!jungsiStatus?.isConfigured) {
    return (
      <PerformanceErrorPanel
        message="이 학원은 아직 정시엔진과 연동되지 않았습니다. 관리자에게 문의해주세요."
        onRetry={onRefreshStatus}
      />
    );
  }

  if (!jungsiStatus.jungsiApi.healthy) {
    return <PerformanceErrorPanel message="정시엔진과 연결할 수 없습니다. 잠시 후 다시 시도해주세요." onRetry={onRefreshStatus} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              정시엔진 연결됨
            </span>
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              {getBranchLabel(jungsiStatus.branchName)}
            </span>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="relative block md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="학생 이름, 학교, 학년"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
            <Button variant="outline" size="sm" onClick={onRefreshStudents}>
              <RefreshCw className="mr-2 h-4 w-4" />
              새로고침
            </Button>
          </div>
        </div>

        {studentsError ? (
          <div className="p-4">
            <PerformanceErrorPanel message={studentsError} onRetry={onRefreshStudents} />
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

      <section className="rounded-md border border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="break-keep">학생을 펼치면 3월, 6월, 9월, 수능 성적을 한 번에 조회합니다.</p>
        </div>
      </section>
    </div>
  );
}
