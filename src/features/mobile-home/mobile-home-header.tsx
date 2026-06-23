import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';

interface MobileHomeHeaderProps {
  academyName: string;
  userName: string;
}

export function MobileHomeHeader({ academyName, userName }: MobileHomeHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <Image src="/icons/icon-96x96.png" alt="P-ACA" width={40} height={40} className="rounded-md" priority />
        </div>
        <div className="min-w-0">
          {academyName && <h1 className="truncate text-xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">{academyName}</h1>}
          {userName && <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{userName}님 안녕하세요</p>}
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
}
