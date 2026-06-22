import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PaymentDetailLoading({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-center gap-3 border-b border-border/70 pb-4">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">학원비 상세</h1>
          <p className="mt-1 text-sm text-muted-foreground">불러오는 중</p>
        </div>
      </header>
      <section className="rounded-lg border border-border/70 bg-card p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="h-20 animate-pulse rounded-md bg-muted" />
          <div className="h-20 animate-pulse rounded-md bg-muted" />
          <div className="h-20 animate-pulse rounded-md bg-muted" />
        </div>
      </section>
    </div>
  );
}
