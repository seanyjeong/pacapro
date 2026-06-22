import type { CreditTypeStats } from '@/lib/types/payment';
import { formatWon, getCreditTypeLabel } from './credits-utils';

interface CreditsTypeStatsProps {
  typeStats: CreditTypeStats[];
}

export function CreditsTypeStats({ typeStats }: CreditsTypeStatsProps) {
  if (typeStats.length === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="타입별 통계">
      {typeStats.map((stat) => (
        <div key={stat.credit_type} className="rounded-lg border border-border/70 bg-card p-4 shadow-none">
          <div className="text-sm text-muted-foreground">{getCreditTypeLabel(stat.credit_type)}</div>
          <div className="mt-1 text-xl font-semibold text-foreground">{formatWon(stat.total_amount)}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {stat.count}건 / 잔여 {formatWon(stat.remaining_amount)}
          </div>
        </div>
      ))}
    </section>
  );
}
