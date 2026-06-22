import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EnrolledConsultationsErrorProps {
  message: string;
  onRetry: () => void;
}

export function EnrolledConsultationsError({ message, onRetry }: EnrolledConsultationsErrorProps) {
  return (
    <section className="rounded-md border border-border bg-card p-8 text-center shadow-none sm:p-12">
      <AlertCircle className="mx-auto mb-4 h-11 w-11 text-red-500" />
      <h2 className="text-lg font-semibold text-foreground">재원생상담 목록을 불러오지 못했습니다</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button type="button" onClick={onRetry} className="mt-5">
        다시 시도
      </Button>
    </section>
  );
}
