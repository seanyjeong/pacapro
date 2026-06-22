import Link from 'next/link';
import { Banknote, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { ReportStats } from './reports-types';

interface ReportActionStripProps {
  stats: ReportStats;
}

export function ReportActionStrip({ stats }: ReportActionStripProps) {
  const actions = [
    {
      label: '미수납 관리',
      meta: `${stats.payments.unpaid}건`,
      href: '/payments?payment_status=pending',
      icon: Banknote,
    },
    {
      label: '수입 내역',
      meta: `기타 ${stats.otherIncomes.total}건`,
      href: '/incomes',
      icon: TrendingUp,
    },
    {
      label: '지출 내역',
      meta: `${stats.expenses.total}건`,
      href: '/expenses',
      icon: TrendingDown,
    },
    {
      label: '학생 관리',
      meta: `재원생 ${stats.students.active}명`,
      href: '/students',
      icon: Users,
    },
  ];

  return (
    <section className="rounded-md border border-border bg-card p-3" aria-label="리포트 빠른 이동">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              href={action.href}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-medium text-foreground">{action.label}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{action.meta}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
