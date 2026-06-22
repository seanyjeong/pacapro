import { Loader2 } from 'lucide-react';

export function SeasonEnrollLoading() {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-7xl items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        시즌 등록 정보를 불러오는 중입니다.
      </div>
    </div>
  );
}
