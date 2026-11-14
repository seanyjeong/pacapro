import type { ReactNode } from 'react';
import Link from 'next/link';
import { Banknote, Eye, UserRound } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/page';
import type { Salary } from '@/lib/types/salary';
import {
  formatSalaryAmount,
  formatYearMonth,
  formatDate,
} from '@/lib/utils/salary-helpers';
import {
  TAX_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/types/salary';

interface SalaryListProps {
  salaries: Salary[];
  loading?: boolean;
  onSalaryClick: (id: number) => void;
  /** 표 카드 맨 위 한 줄(필터) */
  toolbar?: ReactNode;
}

const STATUS_BADGE: Record<string, BadgeProps['variant']> = {
  paid: 'success',
  pending: 'warning',
};

function StatusBadge({ status }: { status: Salary['payment_status'] }) {
  return <Badge variant={STATUS_BADGE[status] ?? 'secondary'}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function SalaryList({ salaries, loading, onSalaryClick, toolbar }: SalaryListProps) {
  return (
    <section className="min-w-0 rounded-2xl bg-card" aria-label={loading ? '급여 내역 로딩' : '급여 내역'}>
      {toolbar ? <div className="border-b border-border/60 p-4 sm:px-6">{toolbar}</div> : null}
      <SalaryListBody salaries={salaries} loading={loading} onSalaryClick={onSalaryClick} />
    </section>
  );
}

function SalaryListBody({ salaries, loading, onSalaryClick }: Omit<SalaryListProps, 'toolbar'>) {
  if (loading) {
    return (
      <div className="space-y-3 p-5 sm:p-6">
        <div className="h-12 w-full rounded-xl bg-muted" />
        <div className="h-12 w-full rounded-xl bg-muted/70" />
        <div className="h-12 w-full rounded-xl bg-muted/50" />
      </div>
    );
  }

  if (salaries.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        title="급여 내역이 없습니다"
        description="필터를 바꾸거나 새로고침 후 다시 확인해 주세요."
      />
    );
  }

  return (
    <>
      <div className="divide-y divide-border/60 px-4 xl:hidden">
        {salaries.map((salary) => {
          const grossAmount = salary.base_amount + salary.incentive_amount;
          const deductionAmount = salary.tax_amount + salary.total_deduction;
          return (
            <article
              key={salary.id}
              aria-label={`${salary.instructor_name} 급여 내역`}
              className="py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-foreground">{salary.instructor_name}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {formatYearMonth(salary.year_month)}
                    {salary.payment_date ? ` · 지급일 ${formatDate(salary.payment_date)}` : ''}
                  </p>
                </div>
                <StatusBadge status={salary.payment_status} />
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0 text-[13px] text-muted-foreground">
                  <p>
                    총액 <span className="font-semibold tabular-nums text-foreground">{formatSalaryAmount(grossAmount)}</span>
                  </p>
                  <div className="mt-0.5">
                    공제 <span className="font-semibold tabular-nums text-destructive">-{formatSalaryAmount(deductionAmount)}</span>
                    <Badge variant="secondary" className="ml-1.5 align-middle">{TAX_TYPE_LABELS[salary.tax_type]}</Badge>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] font-medium text-muted-foreground">실수령액</p>
                  <p className="text-[19px] font-extrabold tabular-nums text-foreground">{formatSalaryAmount(salary.net_salary)}</p>
                </div>
              </div>

              <SalaryActions salary={salary} onSalaryClick={onSalaryClick} mobile />
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto px-2 pb-2 xl:block">
        <table className="w-full min-w-[920px] text-[15px]">
          <thead>
            <tr className="border-b border-border/60 text-[13px] font-semibold text-muted-foreground">
              <th className="px-4 py-3 text-left font-semibold">강사</th>
              <th className="px-4 py-3 text-left font-semibold">급여월</th>
              <th className="px-4 py-3 text-right font-semibold">금액</th>
              <th className="px-4 py-3 text-right font-semibold">공제</th>
              <th className="px-4 py-3 text-right font-semibold">실수령액</th>
              <th className="px-4 py-3 text-left font-semibold">상태</th>
              <th className="px-4 py-3 text-right font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {salaries.map((salary) => (
              <tr
                key={salary.id}
                className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="font-semibold text-foreground">{salary.instructor_name}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-secondary-foreground">
                  {formatYearMonth(salary.year_month)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <div className="font-bold tabular-nums text-foreground">{formatSalaryAmount(salary.base_amount + salary.incentive_amount)}</div>
                  {salary.incentive_amount > 0 && (
                    <div className="text-[13px] tabular-nums text-primary">인센티브 +{formatSalaryAmount(salary.incentive_amount)}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <div className="font-bold tabular-nums text-destructive">-{formatSalaryAmount(salary.tax_amount + salary.total_deduction)}</div>
                  <Badge variant="secondary" className="mt-0.5">{TAX_TYPE_LABELS[salary.tax_type]}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <div className="text-[17px] font-extrabold tabular-nums text-foreground">{formatSalaryAmount(salary.net_salary)}</div>
                  {salary.payment_date && (
                    <div className="text-[13px] text-success">지급 {formatDate(salary.payment_date)}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <StatusBadge status={salary.payment_status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <SalaryActions salary={salary} onSalaryClick={onSalaryClick} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SalaryActions({
  salary,
  onSalaryClick,
  mobile = false,
}: {
  salary: Salary;
  onSalaryClick: (id: number) => void;
  mobile?: boolean;
}) {
  const className = mobile
    ? 'mt-3 grid grid-cols-2 gap-2'
    : 'inline-flex items-center justify-end gap-1.5';
  const buttonClass =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20';

  return (
    <div className={className}>
      <button
        aria-label={`${salary.instructor_name} 급여 명세서 보기`}
        className={buttonClass}
        type="button"
        onClick={() => onSalaryClick(salary.id)}
      >
        <Eye className="h-4 w-4" />
        명세서
      </button>
      <Link
        aria-label={`${salary.instructor_name} 강사 상세 보기`}
        className={buttonClass}
        href={`/instructors/${salary.instructor_id}`}
      >
        <UserRound className="h-4 w-4" />
        강사
      </Link>
    </div>
  );
}
