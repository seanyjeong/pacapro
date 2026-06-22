import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonEditErrorProps {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}

export function SeasonEditError({ message, onBack, onRetry }: SeasonEditErrorProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-700">
        {message}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onBack}>목록으로</Button>
        <Button onClick={onRetry}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          다시 불러오기
        </Button>
      </div>
    </div>
  );
}
