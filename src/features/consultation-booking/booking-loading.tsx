import { Loader2 } from 'lucide-react';

export function BookingLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      <p className="text-sm">로딩 중...</p>
    </div>
  );
}
