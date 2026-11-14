import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface PaymentStatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  subValue?: string;
  tone?: 'default' | 'success' | 'danger' | 'info';
}

export function PaymentStatCard({ label, value, icon, subValue, tone = 'default' }: PaymentStatCardProps) {
  return (
    <Card className="h-full rounded-md border-border shadow-none">
      <CardContent className="flex min-h-[104px] items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-2 truncate text-2xl font-semibold leading-none tracking-normal tabular-nums text-foreground',
              tone === 'success' && 'text-success',
              tone === 'danger' && 'text-destructive',
              tone === 'info' && 'text-primary'
            )}
          >
            {value}
          </p>
          {subValue ? <p className="mt-2 truncate text-xs text-muted-foreground">{subValue}</p> : null}
        </div>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground',
            tone === 'success' && 'border-success/30 bg-success-soft text-success',
            tone === 'danger' && 'border-destructive/30 bg-destructive-soft text-destructive',
            tone === 'info' && 'border-primary/30 bg-primary-soft text-primary'
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
