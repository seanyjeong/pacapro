/**
 * Salary Calculator Component
 * 급여 계산기 컴포넌트 - 출근 기록 기반 자동 계산
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { salariesAPI, WorkSummaryResponse } from '@/lib/api/salaries';
import type { SalaryCalculationResult, TaxType } from '@/lib/types/salary';
import { TAX_TYPE_LABELS, SALARY_TYPE_LABELS } from '@/lib/types/instructor';
import { formatSalaryAmount, calculateTax } from '@/lib/utils/salary-helpers';
import { Loader2, RefreshCw } from 'lucide-react';

interface SalaryCalculatorProps {
  instructors: Array<{ id: number; name: string; salary_type: string; hourly_rate?: string | number; base_salary?: string | number; tax_type?: string }>;
  onCalculated?: (result: SalaryCalculationResult, instructorId: number, yearMonth: string) => void;
}

export function SalaryCalculator({ instructors, onCalculated }: SalaryCalculatorProps) {
  const [instructorId, setInstructorId] = useState(0);
  const [yearMonth, setYearMonth] = useState('');
  const [incentive, setIncentive] = useState(0);
  const [deduction, setDeduction] = useState(0);
  const [result, setResult] = useState<SalaryCalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [loadingWorkData, setLoadingWorkData] = useState(false);
  const [workSummary, setWorkSummary] = useState<WorkSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 강사와 월이 선택되면 근무 기록 자동 조회
  useEffect(() => {
    if (instructorId && yearMonth) {
      fetchWorkSummary();
    } else {
      setWorkSummary(null);
      setResult(null);
    }
  }, [instructorId, yearMonth]);

  const fetchWorkSummary = async () => {
    if (!instructorId || !yearMonth) return;

    try {
      setLoadingWorkData(true);
      setError(null);
      const data = await salariesAPI.getWorkSummary(instructorId, yearMonth);
      setWorkSummary(data);
    } catch (err: any) {
      console.error('Failed to fetch work summary:', err);
      setError(err.response?.data?.message || '근무 기록을 불러오는데 실패했습니다.');
      setWorkSummary(null);
    } finally {
      setLoadingWorkData(false);
    }
  };

  const handleCalculate = async () => {
    if (!instructorId || !yearMonth) {
      toast.error('강사와 급여월을 선택해주세요.');
      return;
    }

    if (!workSummary) {
      toast.error('강사 정보를 불러올 수 없습니다.');
      return;
    }

    // 월급제가 아닌데 출근 기록이 없으면 에러
    if (workSummary.instructor.salary_type !== 'monthly' && !workSummary.work_summary.total_classes) {
      toast.error('근무 기록이 없습니다. 먼저 출근 체크를 완료해주세요.');
      return;
    }

    try {
      setCalculating(true);
      const instructor = workSummary.instructor;
      const summary = workSummary.work_summary;

      // Parse decimal values from DB strings
      const hourlyRate = parseFloat(String(instructor.hourly_rate || '0')) || 0;
      const baseSalary = parseFloat(String(instructor.base_salary || '0')) || 0;
      const morningRate = parseFloat(String(instructor.morning_class_rate || '0')) || 0;
      const afternoonRate = parseFloat(String(instructor.afternoon_class_rate || '0')) || 0;
      const eveningRate = parseFloat(String(instructor.evening_class_rate || '0')) || 0;

      let baseAmount = 0;

      // 급여 유형에 따른 계산
      switch (instructor.salary_type) {
        case 'hourly':
          // 시급제: 시급 × 총 근무시간
          baseAmount = hourlyRate * summary.total_hours;
          break;

        case 'per_class':
          // 수업당: 시간대별 수업료 × 수업 횟수
          baseAmount =
            (morningRate * summary.morning_classes) +
            (afternoonRate * summary.afternoon_classes) +
            (eveningRate * summary.evening_classes);
          // 시간대별 요율이 없으면 시급으로 계산
          if (baseAmount === 0 && hourlyRate > 0) {
            baseAmount = hourlyRate * summary.total_classes;
          }
          break;

        case 'monthly':
          // 월급제: 기본 월급 (출근일수와 무관)
          baseAmount = baseSalary;
          break;

        case 'mixed':
          // 혼합형: 기본급 + 수업당 수당
          baseAmount = baseSalary +
            (morningRate * summary.morning_classes) +
            (afternoonRate * summary.afternoon_classes) +
            (eveningRate * summary.evening_classes);
          break;

        default:
          baseAmount = baseSalary || hourlyRate * summary.total_hours;
      }

      const grossSalary = baseAmount + incentive;

      // 강사의 세금 타입으로 계산 (DB: '3.3%', 'insurance', 'none')
      const taxType = (instructor.tax_type || 'none') as TaxType;
      const taxAmount = calculateTax(grossSalary, taxType);
      const netSalary = grossSalary - taxAmount - deduction;

      const calculationResult: SalaryCalculationResult = {
        base_amount: Math.round(baseAmount),
        incentive_amount: incentive,
        gross_salary: Math.round(grossSalary),
        tax_type: taxType,
        tax_amount: Math.round(taxAmount),
        insurance_amount: 0,
        total_deduction: deduction,
        net_salary: Math.round(netSalary),
        breakdown: {
          salary_type: instructor.salary_type,
          total_hours: summary.total_hours,
          total_classes: summary.total_classes,
          morning_classes: summary.morning_classes,
          afternoon_classes: summary.afternoon_classes,
          evening_classes: summary.evening_classes,
        },
      };

      setResult(calculationResult);
    } catch (err) {
      console.error('Failed to calculate salary:', err);
      toast.error('급여 계산에 실패했습니다.');
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = () => {
    if (result && onCalculated) {
      onCalculated(result, instructorId, yearMonth);
    }
  };

  const selectedInstructor = instructors.find((i) => i.id === instructorId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>급여 계산기</span>
          {workSummary && (
            <Button variant="ghost" size="sm" onClick={fetchWorkSummary}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">강사 *</label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={0}>강사 선택</option>
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name} ({SALARY_TYPE_LABELS[instructor.salary_type as keyof typeof SALARY_TYPE_LABELS] || instructor.salary_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">급여월 *</label>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* 로딩 상태 */}
        {loadingWorkData && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm text-gray-600">근무 기록 조회 중...</span>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 근무 요약 정보 */}
        {workSummary && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-blue-900">근무 기록 요약</h4>
              <span className="text-xs text-blue-600">
                {TAX_TYPE_LABELS[workSummary.instructor.tax_type as keyof typeof TAX_TYPE_LABELS] || workSummary.instructor.tax_type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">급여 유형:</span>
                <span className="font-medium text-blue-900">
                  {SALARY_TYPE_LABELS[workSummary.instructor.salary_type as keyof typeof SALARY_TYPE_LABELS] || workSummary.instructor.salary_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">출근일수:</span>
                <span className="font-medium text-blue-900">{workSummary.work_summary.attendance_days}일</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">총 수업:</span>
                <span className="font-medium text-blue-900">{workSummary.work_summary.total_classes}회</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">총 시간:</span>
                <span className="font-medium text-blue-900">{workSummary.work_summary.total_hours}시간</span>
              </div>
            </div>

            {/* 날짜별 출근 내역 */}
            {workSummary.work_summary.daily_breakdown && Object.keys(workSummary.work_summary.daily_breakdown).length > 0 && (
              <div className="pt-2 border-t border-blue-200">
                <p className="text-xs text-blue-700 mb-2 font-medium">날짜별 출근 내역:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {Object.entries(workSummary.work_summary.daily_breakdown)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, slots]) => {
                      const dateObj = new Date(date);
                      const month = dateObj.getMonth() + 1;
                      const day = dateObj.getDate();
                      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
                      return (
                        <div key={date} className="flex items-center text-xs">
                          <span className="text-blue-800 w-20">
                            {month}/{day}({dayOfWeek})
                          </span>
                          <span className="text-blue-600">{slots.join(', ')}</span>
                        </div>
                      );
                    })}
                </div>
                <div className="text-xs text-blue-800 font-medium mt-2 pt-2 border-t border-blue-200">
                  총 {workSummary.work_summary.total_classes}회 (오전 {workSummary.work_summary.morning_classes} | 오후 {workSummary.work_summary.afternoon_classes} | 저녁 {workSummary.work_summary.evening_classes})
                </div>
              </div>
            )}
          </div>
        )}

        {/* 근무 기록 없음 (월급제가 아닌 경우에만 경고) */}
        {!loadingWorkData && !error && instructorId && yearMonth && !workSummary?.work_summary.total_classes && workSummary?.instructor?.salary_type !== 'monthly' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              선택한 월에 출근 기록이 없습니다. 먼저 강사 출근 체크를 진행해주세요.
            </p>
          </div>
        )}

        {/* 월급제 안내 */}
        {!loadingWorkData && !error && workSummary?.instructor?.salary_type === 'monthly' && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              월급제 강사입니다. 기본 월급 {parseInt(String(workSummary.instructor.base_salary || 0)).toLocaleString()}원이 적용됩니다.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">인센티브</label>
            <input
              type="number"
              value={incentive}
              onChange={(e) => setIncentive(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">공제액</label>
            <input
              type="number"
              value={deduction}
              onChange={(e) => setDeduction(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              min="0"
            />
          </div>
        </div>

        <Button
          onClick={handleCalculate}
          disabled={calculating || !workSummary || loadingWorkData ||
            // 월급제가 아닌데 출근 기록이 없으면 비활성화
            (workSummary?.instructor?.salary_type !== 'monthly' && !workSummary?.work_summary?.total_classes)}
          className="w-full"
        >
          {calculating ? '계산 중...' : '급여 계산'}
        </Button>

        {result && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-2">
            <h4 className="font-semibold text-gray-900 mb-3">계산 결과</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">기본 급여</span>
              <span className="font-medium">{formatSalaryAmount(result.base_amount)}</span>
            </div>
            {result.incentive_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">인센티브</span>
                <span className="font-medium text-blue-600">+{formatSalaryAmount(result.incentive_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span className="text-gray-900">총 급여</span>
              <span>{formatSalaryAmount(result.gross_salary)}</span>
            </div>
            {result.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  세금 ({TAX_TYPE_LABELS[result.tax_type as keyof typeof TAX_TYPE_LABELS] || result.tax_type})
                </span>
                <span className="font-medium text-red-600">-{formatSalaryAmount(result.tax_amount)}</span>
              </div>
            )}
            {result.total_deduction > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">공제액</span>
                <span className="font-medium text-red-600">-{formatSalaryAmount(result.total_deduction)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span className="text-gray-900">실수령액</span>
              <span className="text-primary-600">{formatSalaryAmount(result.net_salary)}</span>
            </div>

            {onCalculated && (
              <Button onClick={handleSave} className="w-full mt-4">
                급여 기록 저장
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
