import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatAmount } from './incomes-utils';

interface IncomeStatCardProps {
  label: string;
  amount: number;
  detail?: string;
  icon: LucideIcon;
}

export function IncomeStatCard({ label, amount, detail, icon: Icon }: IncomeStatCardProps) {
  return (
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatAmount(amount)}원</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
          <Icon className="h-5 w-5 text-foreground" />
        </span>
      </CardContent>
    </Card>
  );
}
