import type { ReactNode } from 'react';
import { Banknote, CreditCard, Percent, TrendingUp } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';
import type { IncomeSummary, IncomeTab } from './incomes-types';
import { formatAmount } from './incomes-utils';

interface IncomeSummaryStripProps {
  summary: IncomeSummary;
  activeTab: IncomeTab;
  onTabChange: (tab: IncomeTab) => void;
}

// 총 수입·학원비·기타 칸을 누르면 아래 목록 구분이 바뀐다(옛 수입 작업 보드의 숫자 칸과 같은 동작).
export function IncomeSummaryStrip({ summary, activeTab, onTabChange }: IncomeSummaryStripProps) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="수입 요약">
      <Tile testId="incomes-metric-total" selected={activeTab === 'all'}>
        <StatTile
          className="flex h-full w-full flex-col"
          label="총 수입"
          value={<Money amount={summary.totalIncome} />}
          icon={TrendingUp}
          tone="success"
          onClick={() => onTabChange('all')}
        />
      </Tile>
      <Tile testId="incomes-metric-tuition" selected={activeTab === 'tuition'}>
        <StatTile
          className="flex h-full w-full flex-col"
          label="학원비 수납"
          value={<Money amount={summary.totalTuition} />}
          note={`${summary.tuitionCount}건`}
          icon={CreditCard}
          tone="primary"
          onClick={() => onTabChange('tuition')}
        />
      </Tile>
      <Tile testId="incomes-metric-other" selected={activeTab === 'other'}>
        <StatTile
          className="flex h-full w-full flex-col"
          label="기타 수입"
          value={<Money amount={summary.totalOther} />}
          note={`${summary.otherCount}건`}
          icon={Banknote}
          tone="primary"
          onClick={() => onTabChange('other')}
        />
      </Tile>
      <div className="min-w-0" data-testid="incomes-metric-ratio">
        <StatTile
          className="h-full"
          label="학원비 비율"
          value={`${summary.tuitionRatio}%`}
          note={(
            <span className="block">
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${summary.tuitionRatio}%` }} />
              </span>
              <span className="mt-1.5 block text-muted-foreground">기타 {summary.otherRatio}%</span>
            </span>
          )}
          icon={Percent}
        />
      </div>
    </section>
  );
}

function Money({ amount }: { amount: number }) {
  // 큰 금액이 휴대폰 두 칸 폭을 넘지 않게 글자만 줄인다.
  return <span className="text-[20px] sm:text-[26px]">{formatAmount(amount)}원</span>;
}

function Tile({ testId, selected, children }: { testId: string; selected: boolean; children: ReactNode }) {
  return (
    <div data-testid={testId} data-selected={selected} className={cn('min-w-0 rounded-2xl', selected && 'ring-2 ring-primary/40')}>
      {children}
    </div>
  );
}
