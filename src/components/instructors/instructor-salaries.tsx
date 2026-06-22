/**
 * Instructor Salaries Component
 * 강사 급여 기록 컴포넌트
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Banknote, TrendingDown, Clock, X } from 'lucide-react';
import type { SalaryRecord } from '@/lib/types/instructor';
import { formatCurrency, getPaymentStatusColor } from '@/lib/utils/instructor-helpers';
import { PAYMENT_STATUS_LABELS } from '@/lib/types/instructor';

interface InstructorSalariesProps {
  salaries: SalaryRecord[];
  loading?: boolean;
}

export function InstructorSalaries({ salaries, loading }: InstructorSalariesProps) {
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);

  if (loading) {
    return (
      <Card className="rounded-md">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base tracking-normal">급여 기록</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">급여 기록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (salaries.length === 0) {
    return (
      <Card className="rounded-md">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-base tracking-normal">급여 기록</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="mb-4 text-muted-foreground">
            <Banknote className="mx-auto h-12 w-12" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">급여 기록이 없습니다</h3>
          <p className="text-muted-foreground">급여 기록이 추가되면 여기에 표시됩니다.</p>
        </CardContent>
      </Card>
    );
  }

  // 총 지급액 계산
  const totalPaid = salaries
    .filter((s) => s.payment_status === 'paid')
    .reduce((sum, s) => sum + parseFloat(s.net_salary || '0'), 0);

  const totalPending = salaries
    .filter((s) => s.payment_status === 'pending')
    .reduce((sum, s) => sum + parseFloat(s.net_salary || '0'), 0);

  return (
    <>
      <Card className="overflow-hidden rounded-md">
        <CardHeader className="border-b border-border px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base tracking-normal">급여 기록</CardTitle>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">지급완료:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">미지급:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(totalPending)}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                    급여월
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                    근무시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                    기본급
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                    세금
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                    실수령액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-normal text-muted-foreground">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {salaries.map((salary) => (
                  <tr
                    key={salary.id}
                    onClick={() => setSelectedSalary(salary)}
                    className="cursor-pointer transition-colors hover:bg-muted/60"
                  >
                    {/* 급여월 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {salary.year_month}
                        </span>
                      </div>
                    </td>

                    {/* 근무시간 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {salary.total_hours ? (
                        <div className="flex items-center gap-1 text-foreground">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{salary.total_hours.toFixed(1)}시간</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* 기본급 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-foreground">
                        {formatCurrency(parseFloat(salary.base_amount || '0'))}
                      </span>
                    </td>

                    {/* 세금 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {parseFloat(salary.tax_amount || '0') > 0 ? (
                        <div className="flex items-center space-x-1 text-red-600">
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span className="text-sm">
                            {formatCurrency(parseFloat(salary.tax_amount || '0'))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* 실수령액 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Banknote className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(parseFloat(salary.net_salary || '0'))}
                        </span>
                      </div>
                    </td>

                    {/* 상태 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPaymentStatusColor(
                          salary.payment_status
                        )}`}
                      >
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

      {/* 급여 상세 모달 */}
      {selectedSalary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-md border border-border bg-card shadow-xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">급여 상세</h3>
                <p className="text-sm text-muted-foreground">{selectedSalary.year_month} 급여</p>
              </div>
              <button
                onClick={() => setSelectedSalary(null)}
                className="rounded-md p-2 transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-4 space-y-4">
              {/* 근무시간 (시급제인 경우) */}
              {selectedSalary.total_hours && (
                <div className="rounded-md bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">총 근무시간</span>
                    <span className="font-semibold text-foreground">
                      {selectedSalary.total_hours.toFixed(1)}시간
                    </span>
                  </div>
                </div>
              )}

              {/* 급여 내역 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">기본급</span>
                  <span className="text-foreground">
                    {formatCurrency(parseFloat(selectedSalary.base_amount || '0'))}
                  </span>
                </div>

                {parseFloat(selectedSalary.incentive_amount || '0') > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">인센티브</span>
                    <span className="text-green-600">
                      +{formatCurrency(parseFloat(selectedSalary.incentive_amount || '0'))}
                    </span>
                  </div>
                )}

                {parseFloat(selectedSalary.total_deduction || '0') > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">공제</span>
                    <span className="text-red-600">
                      -{formatCurrency(parseFloat(selectedSalary.total_deduction || '0'))}
                    </span>
                  </div>
                )}

                {parseFloat(selectedSalary.tax_amount || '0') > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">세금 (3.3%)</span>
                    <span className="text-red-600">
                      -{formatCurrency(parseFloat(selectedSalary.tax_amount || '0'))}
                    </span>
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">실수령액</span>
                    <span className="text-xl font-semibold text-primary">
                      {formatCurrency(parseFloat(selectedSalary.net_salary || '0'))}
                    </span>
                  </div>
                </div>
              </div>

              {/* 상태 및 지급일 */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">지급 상태</span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getPaymentStatusColor(
                      selectedSalary.payment_status
                    )}`}
                  >
                    {PAYMENT_STATUS_LABELS[selectedSalary.payment_status]}
                  </span>
                </div>
                {selectedSalary.payment_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">지급일</span>
                    <span className="text-foreground">
                      {new Date(selectedSalary.payment_date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                )}
              </div>

              {/* 메모 */}
              {selectedSalary.notes && (
                <div className="border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">메모</span>
                  <p className="mt-1 text-foreground">{selectedSalary.notes}</p>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="border-t border-border bg-muted p-4">
              <button
                onClick={() => setSelectedSalary(null)}
                className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
