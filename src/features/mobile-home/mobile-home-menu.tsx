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
    <nav className="grid grid-cols-2 gap-2" aria-label="모바일 업무 메뉴">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-32 flex-col rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950"
          >
            <span className="flex items-start justify-between gap-2">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClassNames[item.tone]}`}>
                <Icon className="h-5 w-5" />
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
            </span>
            <span className="mt-4 block min-w-0">
              <span className="block text-sm font-semibold leading-5 text-zinc-950 dark:text-zinc-50">{item.label}</span>
              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
