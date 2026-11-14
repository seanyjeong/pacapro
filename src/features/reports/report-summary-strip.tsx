import { Banknote, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { StatTile, type Tone } from '@/components/ui/page';
import type { ReportAccess, ReportComputedStats, ReportStats } from './reports-types';
import { canSeeIncomeTotal, canSeeProfit, formatReportAmount } from './reports-utils';

interface ReportSummaryStripProps {
  access: ReportAccess;
  stats: ReportStats;
  computed: ReportComputedStats;
}

interface SummaryItem {
  label: string;
  value: string;
  note?: string;
  tone: Tone;
  icon: typeof Users;
  testId?: string;
}

export function ReportSummaryStrip({ access, stats, computed }: ReportSummaryStripProps) {
  const items: SummaryItem[] = [];

  if (canSeeIncomeTotal(access)) {
    items.push({
      label: '총 수입',
      value: `${formatReportAmount(computed.totalIncome)}원`,
      note: '학원비 수납 + 기타 수입',
      tone: 'success',
      icon: TrendingUp,
    });
  }

  if (access.expenses) {
    items.push({
      label: '총 지출',
      value: `${formatReportAmount(stats.expenses.totalAmount)}원`,
      tone: 'danger',
      icon: TrendingDown,
    });
  }

  if (canSeeProfit(access)) {
    items.push({
      label: '순이익',
      value: `${computed.netProfit >= 0 ? '+' : ''}${formatReportAmount(computed.netProfit)}원`,
      note: `마진율 ${computed.profitMargin}%`,
      tone: computed.netProfit >= 0 ? 'primary' : 'danger',
      icon: Banknote,
      testId: 'reports-metric-net-profit',
    });
  }

  items.push({
    label: '재원생',
    value: `${stats.students.active}명`,
    note: `관리 대상 ${stats.students.total}명`,
    tone: 'neutral',
    icon: Users,
  });

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="리포트 요약">
      {items.map((item) => (
        <div key={item.label} className="min-w-0" data-testid={item.testId}>
          <StatTile
            className="h-full"
            label={item.label}
            // 큰 금액이 휴대폰 두 칸 폭을 넘지 않게 글자만 줄인다.
            value={item.value.endsWith('원') ? <span className="text-[20px] sm:text-[26px]">{item.value}</span> : item.value}
            note={item.note}
            tone={item.tone}
            icon={item.icon}
          />
        </div>
      ))}
    </section>
  );
}
