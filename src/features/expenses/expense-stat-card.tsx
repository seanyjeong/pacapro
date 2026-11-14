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
              tone === 'danger' && 'text-destructive',
              tone === 'warning' && 'text-warning'
            )}
          >
            {value}
          </p>
          {subValue ? <p className="mt-1 text-xs text-muted-foreground">{subValue}</p> : null}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground',
            tone === 'danger' && 'border-destructive/30 bg-destructive-soft text-destructive',
            tone === 'warning' && 'border-warning/30 bg-warning-soft text-warning'
          )}
        >
          {icon}
        </div>
      </div>
    </section>
  );
}
