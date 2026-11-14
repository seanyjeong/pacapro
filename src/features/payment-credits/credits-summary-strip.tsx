import { CreditCard, TrendingDown, Users, WalletCards } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { CreditStats, StudentWithCredit } from '@/lib/types/payment';
import { formatWon, sumStudentRemaining } from './credits-utils';

interface CreditsSummaryStripProps {
  stats: CreditStats;
  studentsWithCredit: StudentWithCredit[];
}

export function CreditsSummaryStrip({ stats, studentsWithCredit }: CreditsSummaryStripProps) {
  const studentTotal = sumStudentRemaining(studentsWithCredit);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="크레딧 요약">
      <StatTile
        label="총 크레딧"
        value={formatWon(stats.total_credit)}
        note={`${stats.total_count}건`}
        icon={CreditCard}
        tone="primary"
      />
      <div className="min-w-0" data-testid="credits-metric-remaining">
        <StatTile
          className="h-full"
          label="잔여 크레딧"
          value={formatWon(stats.total_remaining)}
          note={<span data-testid="credits-metric-pending">대기 {stats.pending_count}건 · {formatWon(stats.pending_amount)}</span>}
          icon={TrendingDown}
          tone="warning"
        />
      </div>
      <StatTile
        label="적용 완료"
        value={`${stats.applied_count}건`}
        note={`부분적용 ${stats.partial_count}건`}
        icon={WalletCards}
        tone="success"
      />
      <div className="min-w-0" data-testid="credits-metric-students">
        <StatTile
          className="h-full"
          label="크레딧 보유 학생"
          value={`${studentsWithCredit.length}명`}
          note={`총 ${formatWon(studentTotal)}`}
          icon={Users}
        />
      </div>
    </section>
  );
}
