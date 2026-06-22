import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentDetailErrorProps {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}

export function PaymentDetailError({ message, onBack, onRetry }: PaymentDetailErrorProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-center gap-3 border-b border-border/70 pb-4">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">학원비 상세</h1>
      </header>
      <section className="rounded-lg border border-border/70 bg-card p-10 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
        <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button type="button" variant="outline" onClick={onBack}>뒤로 가기</Button>
          <Button type="button" onClick={onRetry}>다시 시도</Button>
        </div>
      </section>
    </div>
  );
}
