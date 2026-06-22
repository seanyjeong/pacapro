import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonListHeaderProps {
  onAddSeason: () => void;
  onRefresh: () => void;
}

export function SeasonListHeader({ onAddSeason, onRefresh }: SeasonListHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">시즌 관리</h1>
        <p className="mt-1 text-sm text-slate-600">수시/정시 시즌 등록 및 관리</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
        <Button onClick={onAddSeason}>
          <Plus className="mr-2 h-4 w-4" />
          시즌 등록
        </Button>
      </div>
    </header>
  );
}
