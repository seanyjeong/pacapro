import type { KeyboardEvent } from 'react';
import { Banknote } from 'lucide-react';
import type { Salary } from '@/lib/types/salary';
import {
  formatSalaryAmount,
  formatYearMonth,
  formatDate,
  getPaymentStatusColor,
  getTaxTypeColor,
} from '@/lib/utils/salary-helpers';
import {
  TAX_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/types/salary';

interface SalaryListProps {
  salaries: Salary[];
  loading?: boolean;
  onSalaryClick: (id: number) => void;
}

export function SalaryList({ salaries, loading, onSalaryClick }: SalaryListProps) {
  if (loading) {
    return (
      <section className="rounded-md border border-border bg-card shadow-none" aria-label="급여 내역 로딩">
        <div className="space-y-3 p-5">
          <div className="h-10 w-full rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted/70" />
          <div className="h-10 w-full rounded-md bg-muted/50" />
        </div>
      </section>
    );
  }

  if (salaries.length === 0) {
    return (
      <section className="rounded-md border border-border bg-card p-12 text-center shadow-none">
        <Banknote className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-lg font-semibold text-foreground">급여 내역이 없습니다</h2>
        <p className="text-sm text-muted-foreground">필터를 변경하거나 새로고침 후 다시 확인해주세요.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-card shadow-none" aria-label="급여 내역">
      <div className="border-b border-border/70 px-5 py-4">
        <h2 className="text-sm font-medium text-foreground">급여 내역</h2>
      </div>

      <div className="space-y-3 p-3 lg:hidden">
        {salaries.map((salary) => {
          const grossAmount = salary.base_amount + salary.incentive_amount;
          const deductionAmount = salary.tax_amount + salary.total_deduction;
          return (
            <article
              key={salary.id}
              aria-label={`${salary.instructor_name} 급여 상세 보기`}
              role="button"
              tabIndex={0}
              onClick={() => onSalaryClick(salary.id)}
              onKeyDown={(event) => handleSalaryKeyDown(event, salary.id, onSalaryClick)}
              className="rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{salary.instructor_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatYearMonth(salary.year_month)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusColor(salary.payment_status)}`}>
                  {PAYMENT_STATUS_LABELS[salary.payment_status]}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">총액</p>
                  <p className="mt-1 font-medium text-foreground">{formatSalaryAmount(grossAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">공제</p>
                  <p className="mt-1 text-red-600 dark:text-red-300">-{formatSalaryAmount(deductionAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">실수령액</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{formatSalaryAmount(salary.net_salary)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">과세</p>
                  <span className={`mt-1 inline-flex rounded border px-2 py-0.5 text-xs ${getTaxTypeColor(salary.tax_type)}`}>
                    {TAX_TYPE_LABELS[salary.tax_type]}
                  </span>
                </div>
              </div>

              {salary.payment_date ? (
                <p className="mt-4 rounded-md bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                  지급일 {formatDate(salary.payment_date)}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">강사</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">급여월</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">금액</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">공제</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">실수령액</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {salaries.map((salary) => (
              <tr
                key={salary.id}
                aria-label={`${salary.instructor_name} 급여 상세 보기`}
                role="button"
                tabIndex={0}
                onClick={() => onSalaryClick(salary.id)}
                onKeyDown={(event) => handleSalaryKeyDown(event, salary.id, onSalaryClick)}
                className="cursor-pointer transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <td className="whitespace-nowrap px-5 py-4">
                  <div className="font-medium text-foreground">{salary.instructor_name}</div>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <div className="text-foreground">{formatYearMonth(salary.year_month)}</div>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <div>
                    <div className="font-semibold text-foreground">{formatSalaryAmount(salary.base_amount + salary.incentive_amount)}</div>
                    {salary.incentive_amount > 0 && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">인센티브: +{formatSalaryAmount(salary.incentive_amount)}</div>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <div>
                    <div className="text-red-600 dark:text-red-400">-{formatSalaryAmount(salary.tax_amount + salary.total_deduction)}</div>
                    <span className={`rounded border px-2 py-0.5 text-xs ${getTaxTypeColor(salary.tax_type)}`}>
                      {TAX_TYPE_LABELS[salary.tax_type]}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <div className="text-lg font-bold text-foreground">{formatSalaryAmount(salary.net_salary)}</div>
                  {salary.payment_date && (
                    <div className="text-xs text-green-600 dark:text-green-400">지급: {formatDate(salary.payment_date)}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusColor(salary.payment_status)}`}>
                    {PAYMENT_STATUS_LABELS[salary.payment_status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function handleSalaryKeyDown(event: KeyboardEvent<HTMLElement>, id: number, onSalaryClick: (id: number) => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onSalaryClick(id);
}
