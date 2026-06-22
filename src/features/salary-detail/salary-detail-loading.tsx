import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SalaryDetailLoadingProps {
  onBack: () => void;
}

export function SalaryDetailLoading({ onBack }: SalaryDetailLoadingProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3 border-b border-border/70 pb-4">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">급여 명세서</h1>
      </div>
      <section className="rounded-lg border border-border/70 bg-card p-8">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="mt-4 h-20 rounded-md bg-muted/70" />
      </section>
    </div>
  );
}
