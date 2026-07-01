import type { StudentSeason } from '@/lib/types/season';
import { formatSeasonFee } from '@/lib/types/season';
import { getSeasonPaymentAmounts } from './season-detail-utils';

interface SeasonPaymentAmountSummaryProps {
  enrollment: StudentSeason;
}

export function SeasonPaymentAmountSummary({ enrollment }: SeasonPaymentAmountSummaryProps) {
  const { paidAmount, remainingAmount } = getSeasonPaymentAmounts(enrollment);

  if (paidAmount <= 0) return null;

  return (
    <div className="mt-1 space-y-0.5 text-xs">
      <p className="font-medium text-emerald-700">기납부 {formatSeasonFee(paidAmount)}</p>
      {remainingAmount > 0 ? (
        <p className="font-medium text-rose-600">잔액 {formatSeasonFee(remainingAmount)}</p>
      ) : null}
    </div>
  );
}
