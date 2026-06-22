import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { JungsiStatus } from './performance-types';

interface PerformanceHeaderProps {
  status: JungsiStatus | null;
  statusError: string | null;
  statusLoading: boolean;
}

export function PerformanceHeader({ status, statusError, statusLoading }: PerformanceHeaderProps) {
  const healthy = status?.jungsiApi.healthy;

  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Performance Desk</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">성적관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">내신과 모의고사 성적을 한 화면에서 확인합니다.</p>
      </div>
      <div className="flex h-9 w-fit items-center gap-2 rounded-md border border-border bg-card px-3 text-sm shadow-sm">
        {statusLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">연결 확인 중</span>
          </>
        ) : healthy ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-700">정시엔진 연결됨</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <span className="font-medium text-amber-800">{statusError ? '연결 확인 필요' : '정시엔진 연결 안됨'}</span>
          </>
        )}
      </div>
    </header>
  );
}
