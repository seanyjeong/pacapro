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
  instructorName?: string;
}

export function InstructorSalaries({ salaries, loading, instructorName }: InstructorSalariesProps) {
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>급여 기록</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">급여 기록을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (salaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>급여 기록</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Banknote className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">급여 기록이 없습니다</h3>
          <p className="text-gray-600">급여 기록이 추가되면 여기에 표시됩니다.</p>
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>급여 기록</CardTitle>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">지급완료:</span>
                <span className="font-semibold text-green-600">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">미지급:</span>
                <span className="font-semibold text-yellow-600">{formatCurrency(totalPending)}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    급여월
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기본급
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    세금
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    실수령액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaries.map((salary) => (
                  <tr
                    key={salary.id}
                    onClick={() => setSelectedSalary(salary)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* 급여월 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {salary.year_month}
                        </span>
                      </div>
                    </td>

                    {/* 근무시간 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {salary.total_hours ? (
                        <div className="flex items-center space-x-1 text-gray-900">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm">{salary.total_hours.toFixed(1)}시간</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* 기본급 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
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
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* 실수령액 */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Banknote className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-bold text-blue-600">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">급여 상세</h3>
                <p className="text-sm text-gray-500">{selectedSalary.year_month} 급여</p>
              </div>
              <button
                onClick={() => setSelectedSalary(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-4 space-y-4">
              {/* 근무시간 (시급제인 경우) */}
              {selectedSalary.total_hours && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">총 근무시간</span>
                    <span className="font-semibold text-gray-900">
                      {selectedSalary.total_hours.toFixed(1)}시간
                    </span>
                  </div>
                </div>
              )}

              {/* 급여 내역 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">기본급</span>
                  <span className="text-gray-900">
                    {formatCurrency(parseFloat(selectedSalary.base_amount || '0'))}
                  </span>
                </div>

                {parseFloat(selectedSalary.incentive_amount || '0') > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">인센티브</span>
                    <span className="text-green-600">
                      +{formatCurrency(parseFloat(selectedSalary.incentive_amount || '0'))}
                    </span>
                  </div>
                )}

                {parseFloat(selectedSalary.total_deduction || '0') > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">공제</span>
                    <span className="text-red-600">
                      -{formatCurrency(parseFloat(selectedSalary.total_deduction || '0'))}
                    </span>
                  </div>
                )}

                {parseFloat(selectedSalary.tax_amount || '0') > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">세금 (3.3%)</span>
                    <span className="text-red-600">
                      -{formatCurrency(parseFloat(selectedSalary.tax_amount || '0'))}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">실수령액</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(parseFloat(selectedSalary.net_salary || '0'))}
                    </span>
                  </div>
                </div>
              </div>

              {/* 상태 및 지급일 */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">지급 상태</span>
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
                    <span className="text-sm text-gray-600">지급일</span>
                    <span className="text-gray-900">
                      {new Date(selectedSalary.payment_date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                )}
              </div>

              {/* 메모 */}
              {selectedSalary.notes && (
                <div className="pt-3 border-t">
                  <span className="text-sm text-gray-600">메모</span>
                  <p className="mt-1 text-gray-900">{selectedSalary.notes}</p>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setSelectedSalary(null)}
                className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
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
