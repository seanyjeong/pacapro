import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { toneIcon } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';
import type { MobileHomeMenuItem } from './mobile-home-types';

interface MobileHomeMenuProps {
  items: MobileHomeMenuItem[];
}

export function MobileHomeMenu({ items }: MobileHomeMenuProps) {
  const visibleItems = items.filter((item) => item.permission);

  return (
    <nav className="rounded-2xl bg-card p-2" aria-label="모바일 업무 메뉴">
      <ul className="divide-y divide-border/60">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-[68px] items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted active:bg-muted"
              >
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', toneIcon[item.tone])}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-foreground">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{item.description}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
