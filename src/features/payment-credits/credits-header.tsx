import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreditsHeaderProps {
  loading: boolean;
  onReload: () => void;
}

export function CreditsHeader({ loading, onReload }: CreditsHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">크레딧 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">휴원, 환불, 수동 크레딧 잔액과 적용 상태를 확인합니다.</p>
      </div>
      <Button type="button" variant="outline" onClick={onReload} disabled={loading} className="w-full sm:w-auto lg:self-start">
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        새로고침
      </Button>
    </header>
  );
}
