import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonListErrorProps {
  message: string;
  onRetry: () => void;
}

export function SeasonListError({ message, onRetry }: SeasonListErrorProps) {
  return (
    <section className="rounded-md border border-rose-200 bg-rose-50 px-5 py-6">
      <p className="break-keep text-sm font-medium text-rose-900">{message}</p>
      <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        다시 불러오기
      </Button>
    </section>
  );
}
