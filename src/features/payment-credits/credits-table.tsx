import { WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Credit } from '@/lib/types/payment';
import {
  CREDIT_STATUS_BADGE_COLORS,
  CREDIT_TYPE_BADGE_COLORS,
} from './credits-constants';
import {
  formatCreditPeriod,
  formatWon,
  getCreditStatusLabel,
  getCreditTypeLabel,
  getStudentStatusLabel,
} from './credits-utils';

interface CreditsTableProps {
  credits: Credit[];
}

export function CreditsTable({ credits }: CreditsTableProps) {
  if (credits.length === 0) {
    return (
      <section className="rounded-lg border border-border/70 bg-card p-12 text-center shadow-none">
        <WalletCards className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">크레딧 내역이 없습니다</h2>
        <p className="mt-1 text-sm text-muted-foreground">필터를 변경하거나 새로고침 후 다시 확인해주세요.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-none" aria-label="크레딧 내역">
      <div className="border-b border-border/70 px-5 py-4">
        <h2 className="text-sm font-medium text-foreground">크레딧 내역</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">학생</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">구분</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">기간/발생일</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">발생</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">잔여</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">상태</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {credits.map((credit) => (
              <tr key={credit.id} className="transition-colors hover:bg-muted/35">
                <td className="px-5 py-4">
                  <div className="font-medium text-foreground">{credit.student_name}</div>
                  {credit.student_status !== 'active' ? (
                    <div className="mt-1 text-xs text-muted-foreground">{getStudentStatusLabel(credit.student_status)}</div>
                  ) : null}
                </td>
                <td className="px-5 py-4">
                  <Badge className={`border ${CREDIT_TYPE_BADGE_COLORS[credit.credit_type]}`}>
                    {getCreditTypeLabel(credit.credit_type)}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-muted-foreground">{formatCreditPeriod(credit)}</td>
                <td className="px-5 py-4 font-medium text-foreground">{formatWon(credit.credit_amount)}</td>
                <td className="px-5 py-4 font-semibold text-orange-700">{formatWon(credit.remaining_amount)}</td>
                <td className="px-5 py-4">
                  <Badge className={`border ${CREDIT_STATUS_BADGE_COLORS[credit.status]}`}>
                    {getCreditStatusLabel(credit.status)}
                  </Badge>
                </td>
                <td className="max-w-[240px] px-5 py-4 text-muted-foreground">
                  <span className="line-clamp-2">{credit.notes || '-'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
