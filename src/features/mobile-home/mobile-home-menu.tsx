import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { MobileHomeMenuItem } from './mobile-home-types';

interface MobileHomeMenuProps {
  items: MobileHomeMenuItem[];
}

const toneClassNames: Record<MobileHomeMenuItem['tone'], string> = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export function MobileHomeMenu({ items }: MobileHomeMenuProps) {
  const visibleItems = items.filter((item) => item.permission);

  return (
    <nav className="space-y-2" aria-label="모바일 업무 메뉴">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneClassNames[item.tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">{item.label}</span>
              <span className="mt-0.5 block truncate text-sm text-zinc-500 dark:text-zinc-400">{item.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
          </Link>
        );
      })}
    </nav>
  );
}
