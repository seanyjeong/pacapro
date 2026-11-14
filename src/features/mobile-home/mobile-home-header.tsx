import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { PageHeader } from '@/components/ui/page';

interface MobileHomeHeaderProps {
  academyName: string;
  dateLabel: string;
  userName: string;
  weekdayLabel: string;
}

export function MobileHomeHeader({ academyName, dateLabel, userName, weekdayLabel }: MobileHomeHeaderProps) {
  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image src="/icons/icon-96x96.png" alt="P-ACA" width={32} height={32} className="shrink-0 rounded-xl" priority />
          <span className="truncate text-[15px] font-bold text-foreground">{academyName || 'P-ACA'}</span>
        </div>
        <ThemeToggle />
      </div>
      <PageHeader
        className="px-1 pt-0"
        title={userName ? `${userName}님, 안녕하세요` : '안녕하세요'}
        description={`${dateLabel} ${weekdayLabel}`}
      />
    </header>
  );
}
