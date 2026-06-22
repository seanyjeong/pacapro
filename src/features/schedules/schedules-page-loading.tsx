import { Loader2 } from 'lucide-react';

export function SchedulesLoading() {
  return (
    <div className="flex min-h-[360px] items-center justify-center gap-3 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      수업 일정을 불러오는 중입니다.
    </div>
  );
}
