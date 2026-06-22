/**
 * Salary List Component
 * 급여 목록 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
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
      <Card className="rounded-lg border-border/70 shadow-none">
        <CardContent className="space-y-3 p-5">
          <div className="h-10 w-full rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted/70" />
          <div className="h-10 w-full rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  if (salaries.length === 0) {
    return (
      <Card className="rounded-lg border-border/70 shadow-none">
        <CardContent className="p-12 text-center">
          <Banknote className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">급여 내역이 없습니다</h3>
          <p className="text-muted-foreground">급여를 등록하시면 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
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
                <tr key={salary.id} onClick={() => onSalaryClick(salary.id)} className="cursor-pointer transition-colors hover:bg-muted/35">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-foreground">{salary.instructor_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-foreground">{formatYearMonth(salary.year_month)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-semibold text-foreground">{formatSalaryAmount(salary.base_amount + salary.incentive_amount)}</div>
                      {salary.incentive_amount > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">인센티브: +{formatSalaryAmount(salary.incentive_amount)}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-red-600 dark:text-red-400">-{formatSalaryAmount(salary.tax_amount + salary.total_deduction)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded ${getTaxTypeColor(salary.tax_type)}`}>
                        {TAX_TYPE_LABELS[salary.tax_type]}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-lg text-foreground">{formatSalaryAmount(salary.net_salary)}</div>
                    {salary.payment_date && (
                      <div className="text-xs text-green-600 dark:text-green-400">지급: {formatDate(salary.payment_date)}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(salary.payment_status)}`}>
                      {PAYMENT_STATUS_LABELS[salary.payment_status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
