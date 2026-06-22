import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreditsErrorProps {
  message: string;
  onRetry: () => void;
}

export function CreditsError({ message, onRetry }: CreditsErrorProps) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="border-b border-border/70 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">크레딧 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">휴원, 환불, 수동 크레딧 잔액과 적용 상태를 확인합니다.</p>
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
