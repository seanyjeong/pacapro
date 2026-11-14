import Link from 'next/link';
import { WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/page';
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
  /** 카드 맨 위 필터 줄 */
  toolbar?: ReactNode;
}

export function CreditsTable({ credits, toolbar }: CreditsTableProps) {
  if (credits.length === 0) {
    return (
      <section className="min-w-0 overflow-hidden rounded-2xl bg-card" aria-label="크레딧 내역">
        {toolbar}
        <EmptyState
          icon={WalletCards}
          title="크레딧 내역이 없습니다"
          description="필터를 변경하거나 새로고침 후 다시 확인해주세요."
          className="py-14"
        />
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl bg-card" aria-label="크레딧 내역">
      {toolbar}
      <div className="divide-y divide-border/60 lg:hidden">
        {credits.map((credit) => (
          <article key={credit.id} className="px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  aria-label={`${credit.student_name} 학생 상세 보기`}
                  className="truncate text-[16px] font-bold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  href={`/students/${credit.student_id}`}
                >
                  {credit.student_name}
                </Link>
                {credit.student_status !== 'active' ? (
                  <p className="mt-1 text-xs text-muted-foreground">{getStudentStatusLabel(credit.student_status)}</p>
                ) : null}
              </div>
              <Badge className={`shrink-0 ${CREDIT_STATUS_BADGE_COLORS[credit.status]}`}>
                {getCreditStatusLabel(credit.status)}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[13px] text-muted-foreground">구분</p>
                <Badge className={`mt-1 ${CREDIT_TYPE_BADGE_COLORS[credit.credit_type]}`}>
                  {getCreditTypeLabel(credit.credit_type)}
                </Badge>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">기간/발생일</p>
                <p className="mt-1 text-foreground">{formatCreditPeriod(credit)}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">발생</p>
                <p className="mt-1 font-bold tabular-nums text-foreground">{formatWon(credit.credit_amount)}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">잔여</p>
                <p
                  className={cn(
                    'mt-1 text-[17px] font-extrabold tabular-nums text-warning',
                    credit.remaining_amount === 0 && 'text-muted-foreground'
                  )}
                >
                  {formatWon(credit.remaining_amount)}
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{credit.notes || '-'}</p>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] text-sm [&_td:not(:last-child)]:whitespace-nowrap">
          <thead className="border-b border-border/60">
            <tr>
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-muted-foreground">학생</th>
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-muted-foreground">구분</th>
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-muted-foreground">기간/발생일</th>
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-muted-foreground">발생</th>
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-muted-foreground">잔여</th>
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-muted-foreground">상태</th>
              <th className="px-5 py-3 text-left text-[13px] font-semibold text-muted-foreground">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {credits.map((credit) => (
              <tr key={credit.id} className="transition-colors hover:bg-muted/60">
                <td className="px-5 py-3.5">
                  <Link
                    aria-label={`${credit.student_name} 학생 상세 보기`}
                    className="text-[15px] font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    href={`/students/${credit.student_id}`}
                  >
                    {credit.student_name}
                  </Link>
                  {credit.student_status !== 'active' ? (
                    <div className="mt-1 text-xs text-muted-foreground">{getStudentStatusLabel(credit.student_status)}</div>
                  ) : null}
                </td>
                <td className="px-5 py-3.5">
                  <Badge className={CREDIT_TYPE_BADGE_COLORS[credit.credit_type]}>
                    {getCreditTypeLabel(credit.credit_type)}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatCreditPeriod(credit)}</td>
                <td className="px-5 py-3.5 font-semibold tabular-nums text-foreground">{formatWon(credit.credit_amount)}</td>
                <td className="px-5 py-3.5 text-[15px] font-bold tabular-nums text-warning">{formatWon(credit.remaining_amount)}</td>
                <td className="px-5 py-3.5">
                  <Badge className={CREDIT_STATUS_BADGE_COLORS[credit.status]}>
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
