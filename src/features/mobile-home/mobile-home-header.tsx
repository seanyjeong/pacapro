import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { PageHeader } from '@/components/ui/page';

interface MobileHomeHeaderProps {
  academyName: string;
  userName: string;
}

export function MobileHomeHeader({ academyName, userName }: MobileHomeHeaderProps) {
  return (
    <header className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Image src="/icons/icon-96x96.png" alt="P-ACA" width={36} height={36} className="shrink-0 rounded-xl" priority />
        <ThemeToggle />
      </div>
      <PageHeader
        className="px-1 pt-0"
        title={academyName || 'P-ACA'}
        description={userName ? `${userName}님 안녕하세요` : undefined}
      />
    </header>
  );
}
