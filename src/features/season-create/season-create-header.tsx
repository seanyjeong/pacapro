import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonCreateHeaderProps {
  onBack: () => void;
}

export function SeasonCreateHeader({ onBack }: SeasonCreateHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-normal text-slate-950">시즌 등록</h1>
        <p className="mt-1 text-sm text-slate-500">수시/정시 시즌 운영 기준을 생성합니다</p>
      </div>
      <Button className="w-full sm:w-auto" variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        뒤로
      </Button>
    </header>
  );
}
