import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SalaryDetailErrorProps {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}

export function SalaryDetailError({ message, onBack, onRetry }: SalaryDetailErrorProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3 border-b border-border/70 pb-4">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">급여 명세서</h1>
      </div>
      <section className="rounded-lg border border-border/70 bg-card p-12 text-center shadow-none">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button type="button" variant="outline" onClick={onBack}>뒤로 가기</Button>
          <Button type="button" onClick={onRetry}>다시 시도</Button>
        </div>
      </section>
    </div>
  );
}
