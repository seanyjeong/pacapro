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
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">성적관리</h1>
        <p className="mt-1 text-sm text-slate-600">내신과 모의고사 성적을 한 화면에서 확인합니다.</p>
      </div>
      <div className="flex h-9 w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm">
        {statusLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            <span className="text-slate-600">연결 확인 중</span>
          </>
        ) : healthy ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-700">정시엔진 연결됨</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span className="font-medium text-rose-700">{statusError ? '연결 확인 필요' : '정시엔진 연결 안됨'}</span>
          </>
        )}
      </div>
    </header>
  );
}
