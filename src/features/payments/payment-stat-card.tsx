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
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-1 truncate text-2xl font-semibold tracking-normal tabular-nums text-foreground',
              tone === 'success' && 'text-green-700',
              tone === 'danger' && 'text-red-600',
              tone === 'info' && 'text-blue-700'
            )}
          >
            {value}
          </p>
          {subValue ? <p className="mt-1 text-xs text-muted-foreground">{subValue}</p> : null}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground',
            tone === 'success' && 'border-green-200 bg-green-50 text-green-700',
            tone === 'danger' && 'border-red-200 bg-red-50 text-red-600',
            tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-700'
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
