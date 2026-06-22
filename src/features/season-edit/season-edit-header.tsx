import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonEditHeaderProps {
  onBack: () => void;
}

export function SeasonEditHeader({ onBack }: SeasonEditHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Season Setup</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">시즌 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">시즌 운영 기준과 상태를 수정합니다</p>
      </div>
      <Button className="w-full sm:w-auto" variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        뒤로
      </Button>
    </header>
  );
}
