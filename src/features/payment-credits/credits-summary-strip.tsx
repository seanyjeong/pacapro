import { CreditCard, TrendingDown, Users, WalletCards } from 'lucide-react';
import type { CreditStats, StudentWithCredit } from '@/lib/types/payment';
import { CreditStatCard } from './credit-stat-card';
import { formatWon, sumStudentRemaining } from './credits-utils';

interface CreditsSummaryStripProps {
  stats: CreditStats;
  studentsWithCredit: StudentWithCredit[];
}

export function CreditsSummaryStrip({ stats, studentsWithCredit }: CreditsSummaryStripProps) {
  const studentTotal = sumStudentRemaining(studentsWithCredit);

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="크레딧 요약">
      <CreditStatCard
        label="총 크레딧"
        value={formatWon(stats.total_credit)}
        detail={`${stats.total_count}건`}
        icon={CreditCard}
        tone="blue"
      />
      <CreditStatCard
        label="잔여 크레딧"
        value={formatWon(stats.total_remaining)}
        detail={`대기 ${stats.pending_count}건`}
        icon={TrendingDown}
        tone="orange"
      />
      <CreditStatCard
        label="적용 완료"
        value={`${stats.applied_count}건`}
        detail={`부분적용 ${stats.partial_count}건`}
        icon={WalletCards}
        tone="green"
      />
      <CreditStatCard
        label="크레딧 보유 학생"
        value={`${studentsWithCredit.length}명`}
        detail={`총 ${formatWon(studentTotal)}`}
        icon={Users}
      />
    </section>
  );
}
