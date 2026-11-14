import Link from 'next/link';
import { Banknote, ChevronRight, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { SectionCard, toneIcon, type Tone } from '@/components/ui/page';
import type { ReportAccess, ReportStats } from './reports-types';

interface ReportQuickLinksProps {
  access: ReportAccess;
  stats: ReportStats;
}

export function ReportQuickLinks({ access, stats }: ReportQuickLinksProps) {
  const links: Array<{ label: string; meta: string; href: string; icon: typeof Users; tone: Tone; visible: boolean }> = [
    { label: '미수납 관리', meta: `${stats.payments.unpaid}건`, href: '/payments?payment_status=pending', icon: Banknote, tone: 'danger', visible: access.payments },
    { label: '수입 내역', meta: `기타 ${stats.otherIncomes.total}건`, href: '/incomes', icon: TrendingUp, tone: 'success', visible: access.incomes },
    { label: '지출 내역', meta: `${stats.expenses.total}건`, href: '/expenses', icon: TrendingDown, tone: 'warning', visible: access.expenses },
    { label: '학생 관리', meta: '학생 목록', href: '/students', icon: Users, tone: 'primary', visible: true },
  ];

  return (
    <SectionCard title="바로 가기">
      <nav aria-label="리포트 빠른 이동" className="divide-y divide-border/60">
        {links.filter((link) => link.visible).map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneIcon[link.tone]}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{link.label}</span>
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">{link.meta}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
            </Link>
          );
        })}
      </nav>
    </SectionCard>
  );
}
