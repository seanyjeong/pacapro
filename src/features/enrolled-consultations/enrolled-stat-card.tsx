import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface EnrolledStatCardProps {
  label: string;
  helper: string;
  icon: ReactNode;
  tone?: 'default' | 'pending' | 'confirmed' | 'completed';
  value: number;
}

export function EnrolledStatCard({ label, helper, icon, tone = 'default', value }: EnrolledStatCardProps) {
  return (
    <section className="rounded-md border border-border bg-card shadow-none">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-normal text-foreground tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground',
            tone === 'pending' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-300',
            tone === 'confirmed' && 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/45 dark:text-sky-300',
            tone === 'completed' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/45 dark:text-emerald-300',
          )}
        >
          {icon}
        </div>
      </div>
    </section>
  );
}
