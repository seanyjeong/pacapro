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
              tone === 'success' && 'text-emerald-700 dark:text-emerald-300',
              tone === 'danger' && 'text-red-600 dark:text-red-300',
              tone === 'info' && 'text-blue-700 dark:text-blue-300'
            )}
          >
            {value}
          </p>
          {subValue ? <p className="mt-2 truncate text-xs text-muted-foreground">{subValue}</p> : null}
        </div>
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground',
            tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
            tone === 'danger' && 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
            tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
