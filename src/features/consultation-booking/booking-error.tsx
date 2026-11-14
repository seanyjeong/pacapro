import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingErrorProps {
  message: string;
  onRetry: () => void;
}

export function BookingError({ message, onRetry }: BookingErrorProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center">
      <div className="flex flex-col items-center rounded-2xl bg-card px-5 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <AlertCircle className="h-6 w-6" />
        </span>
        <p className="mt-4 text-[15px] font-semibold text-foreground">{message}</p>
      </div>
      <Button className="mt-4 w-full" size="lg" onClick={onRetry}>
        <RefreshCcw className="h-4 w-4" />
        다시 불러오기
      </Button>
    </div>
  );
}
