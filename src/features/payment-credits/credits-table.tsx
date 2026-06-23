import { WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Credit } from '@/lib/types/payment';
import { cn } from '@/lib/utils/cn';
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
      <section className="rounded-md border border-border bg-card p-12 text-center shadow-none">
        <WalletCards className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">크레딧 내역이 없습니다</h2>
        <p className="mt-1 text-sm text-muted-foreground">필터를 변경하거나 새로고침 후 다시 확인해주세요.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-card shadow-none" aria-label="크레딧 내역">
      <div className="border-b border-border/70 px-5 py-4">
        <h2 className="text-sm font-medium text-foreground">크레딧 내역</h2>
      </div>
      <div className="space-y-3 p-3 lg:hidden">
        {credits.map((credit) => (
          <article key={credit.id} className="rounded-md border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{credit.student_name}</p>
                {credit.student_status !== 'active' ? (
                  <p className="mt-1 text-xs text-muted-foreground">{getStudentStatusLabel(credit.student_status)}</p>
                ) : null}
              </div>
              <Badge className={`shrink-0 border ${CREDIT_STATUS_BADGE_COLORS[credit.status]}`}>
                {getCreditStatusLabel(credit.status)}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">구분</p>
                <Badge className={`mt-1 border ${CREDIT_TYPE_BADGE_COLORS[credit.credit_type]}`}>
                  {getCreditTypeLabel(credit.credit_type)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">기간/발생일</p>
                <p className="mt-1 text-foreground">{formatCreditPeriod(credit)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">발생</p>
                <p className="mt-1 font-medium text-foreground">{formatWon(credit.credit_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">잔여</p>
                <p
                  className={cn(
                    'mt-1 font-semibold text-orange-700 dark:text-orange-300',
                    credit.remaining_amount === 0 && 'text-muted-foreground'
                  )}
                >
                  {formatWon(credit.remaining_amount)}
                </p>
              </div>
            </div>

            <p className="mt-4 rounded-md bg-muted/35 px-3 py-2 text-sm text-muted-foreground">{credit.notes || '-'}</p>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] text-sm">
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
