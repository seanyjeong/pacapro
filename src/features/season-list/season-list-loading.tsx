import { Loader2 } from 'lucide-react';

export function SeasonListLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      시즌 목록을 불러오는 중입니다.
    </div>
  );
}
