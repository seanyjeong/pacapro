import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingErrorProps {
  message: string;
  onRetry: () => void;
}

export function BookingError({ message, onRetry }: BookingErrorProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center px-4">
      <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-700">
        {message}
      </div>
      <Button className="mt-4" onClick={onRetry}>
        <RefreshCcw className="mr-2 h-4 w-4" />
        다시 불러오기
      </Button>
    </div>
  );
}
