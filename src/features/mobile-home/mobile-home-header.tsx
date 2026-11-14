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
        <div className="rounded-lg border border-border bg-card p-2">
          <Image src="/icons/icon-96x96.png" alt="P-ACA" width={40} height={40} className="rounded-md" priority />
        </div>
        <div className="min-w-0">
          {academyName && <h1 className="truncate text-xl font-semibold tracking-normal text-foreground">{academyName}</h1>}
          {userName && <p className="truncate text-sm text-muted-foreground">{userName}님 안녕하세요</p>}
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
}
