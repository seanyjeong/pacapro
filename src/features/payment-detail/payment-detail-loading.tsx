import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

export function PaymentDetailLoading({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기" className="-ml-2 mt-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader className="min-w-0 flex-1" title="학원비 상세" description="불러오는 중" />
      </div>
      <section className="rounded-2xl bg-card p-6">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        </div>
      </section>
    </div>
  );
}
