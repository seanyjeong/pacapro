import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentEditorErrorProps {
  message: string;
  onRetry: () => void;
  onList: () => void;
}

export function PaymentEditorError({ message, onRetry, onList }: PaymentEditorErrorProps) {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-10 text-center">
      <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
      <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">{message}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button type="button" variant="outline" onClick={onList}>목록으로</Button>
        <Button type="button" onClick={onRetry}>다시 시도</Button>
      </div>
    </section>
  );
}
