import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SalariesErrorProps {
  message: string;
  onRetry: () => void;
}

export function SalariesError({ message, onRetry }: SalariesErrorProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="border-b border-border/70 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">급여 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">강사 출근 기록 기반 급여와 지급 상태를 확인합니다.</p>
      </header>
      <section className="rounded-lg border border-border/70 bg-card p-12 text-center shadow-none">
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
