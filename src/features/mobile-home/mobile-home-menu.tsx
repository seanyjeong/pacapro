import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { MobileHomeMenuItem } from './mobile-home-types';

interface MobileHomeMenuProps {
  items: MobileHomeMenuItem[];
}

const toneClassNames: Record<MobileHomeMenuItem['tone'], string> = {
  blue: 'bg-primary-soft text-primary',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  amber: 'bg-warning-soft text-warning',
  emerald: 'bg-success-soft text-success',
};

export function MobileHomeMenu({ items }: MobileHomeMenuProps) {
  const visibleItems = items.filter((item) => item.permission);

  return (
    <nav className="grid grid-cols-2 gap-2" aria-label="모바일 업무 메뉴">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-32 flex-col rounded-lg border border-border bg-card p-3 text-left shadow-sm transition active:scale-[0.99]"
          >
            <span className="flex items-start justify-between gap-2">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClassNames[item.tone]}`}>
                <Icon className="h-5 w-5" />
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </span>
            <span className="mt-4 block min-w-0">
              <span className="block text-sm font-semibold leading-5 text-foreground">{item.label}</span>
              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
