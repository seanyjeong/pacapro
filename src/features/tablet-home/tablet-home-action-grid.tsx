import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SectionCard } from '@/components/ui/page';
import type { TabletHomeAction } from './tablet-home-types';

interface TabletHomeActionGridProps {
  actions: TabletHomeAction[];
  title: string;
}

export function TabletHomeActionGrid({ actions, title }: TabletHomeActionGridProps) {
  if (actions.length === 0) return null;

  return (
    <SectionCard title={title}>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" aria-label={title}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              aria-label={action.label}
              className="group flex min-h-[72px] items-center gap-3 rounded-xl bg-muted px-4 py-3 transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-foreground">{action.label}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{action.description}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}
