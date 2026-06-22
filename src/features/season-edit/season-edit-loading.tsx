import { Loader2 } from 'lucide-react';

export function SeasonEditLoading() {
  return (
    <div className="flex min-h-[360px] items-center justify-center" data-testid="season-edit-loading">
      <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
    </div>
  );
}
