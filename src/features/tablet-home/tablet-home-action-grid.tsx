import Link from 'next/link';
import type { TabletHomeAction } from './tablet-home-types';

interface TabletHomeActionGridProps {
  actions: TabletHomeAction[];
  title: string;
}

export function TabletHomeActionGrid({ actions, title }: TabletHomeActionGridProps) {
  if (actions.length === 0) return null;

  return (
    <section className="rounded-md border border-border bg-background p-4" aria-label={title}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              aria-label={action.label}
              className="group rounded-md border border-border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/45 focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground group-hover:text-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.description}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
