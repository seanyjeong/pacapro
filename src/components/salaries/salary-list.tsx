/**
 * Salary List Component
 * 급여 목록 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
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
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">급여 목록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (salaries.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">급여 내역이 없습니다</h3>
          <p className="text-gray-600">급여를 등록하시면 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">강사</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">급여월</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">공제</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">실수령액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {salaries.map((salary) => (
                <tr key={salary.id} onClick={() => onSalaryClick(salary.id)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{salary.instructor_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-gray-900">{formatYearMonth(salary.year_month)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-semibold text-gray-900">{formatSalaryAmount(salary.base_amount + salary.incentive_amount)}</div>
                      {salary.incentive_amount > 0 && (
                        <div className="text-xs text-blue-600">인센티브: +{formatSalaryAmount(salary.incentive_amount)}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-red-600">-{formatSalaryAmount(salary.tax_amount + salary.total_deduction)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded ${getTaxTypeColor(salary.tax_type)}`}>
                        {TAX_TYPE_LABELS[salary.tax_type]}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-lg text-gray-900">{formatSalaryAmount(salary.net_salary)}</div>
                    {salary.payment_date && (
                      <div className="text-xs text-green-600">지급: {formatDate(salary.payment_date)}</div>
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
