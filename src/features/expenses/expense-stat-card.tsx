import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface ExpenseStatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  subValue?: string;
  tone?: 'default' | 'danger' | 'warning';
}

export function ExpenseStatCard({ label, value, icon, subValue, tone = 'default' }: ExpenseStatCardProps) {
  return (
    <section className="rounded-md border border-border bg-card shadow-none">
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-1 truncate text-2xl font-semibold tracking-normal tabular-nums text-foreground',
              tone === 'danger' && 'text-red-600 dark:text-red-300',
              tone === 'warning' && 'text-amber-700 dark:text-amber-300'
            )}
          >
            {value}
          </p>
          {subValue ? <p className="mt-1 text-xs text-muted-foreground">{subValue}</p> : null}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground',
            tone === 'danger' && 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/45 dark:text-red-300',
            tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-300'
          )}
        >
          {icon}
        </div>
      </div>
    </section>
  );
}
