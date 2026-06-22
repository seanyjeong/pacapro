import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IncomesErrorProps {
  message: string;
  onRetry: () => void;
}

export function IncomesError({ message, onRetry }: IncomesErrorProps) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
      <header className="border-b border-border/70 pb-4">
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Finance Desk</div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">수입 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">학원비 수납과 기타 수입을 확인합니다.</p>
      </header>
      <section className="rounded-md border border-border bg-card p-12 text-center shadow-none">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="text-lg font-semibold text-foreground">정보를 불러오지 못했습니다</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button type="button" onClick={onRetry} className="mt-5">
          다시 시도
        </Button>
      </section>
    </div>
  );
}
