/**
 * Salary Calculator Component
 * Uses backend work-summary + calculate endpoints
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { salariesAPI } from '@/lib/api/salaries';
import type { Salary, WorkSummaryResponse } from '@/lib/types/salary';
import { SALARY_TYPE_LABELS } from '@/lib/types/instructor';
import { formatSalaryAmount } from '@/lib/utils/salary-helpers';
import { Loader2, RefreshCw } from 'lucide-react';

interface SalaryCalculatorProps {
  instructors: Array<{ id: number; name: string; salary_type: string }>;
  onCalculated?: (salary: Salary) => void;
}

export function SalaryCalculator({ instructors, onCalculated }: SalaryCalculatorProps) {
  const [instructorId, setInstructorId] = useState(0);
  const [yearMonth, setYearMonth] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [loadingWorkData, setLoadingWorkData] = useState(false);
  const [workSummary, setWorkSummary] = useState<WorkSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instructorId && yearMonth) {
      fetchWorkSummary();
    } else {
      setWorkSummary(null);
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

    try {
      setCalculating(true);
      const salary = await salariesAPI.calculateSalary({
        instructor_id: instructorId,
        year_month: yearMonth,
      });

      toast.success(`급여가 계산되었습니다. 총 급여: ${formatSalaryAmount(salary.total_salary)}`);
      onCalculated?.(salary);
    } catch (err: any) {
      console.error('Failed to calculate salary:', err);
      toast.error(err.response?.data?.detail || '급여 계산에 실패했습니다.');
    } finally {
      setCalculating(false);
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

        {loadingWorkData && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm text-gray-600">근무 기록 조회 중...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {workSummary && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-blue-900">근무 기록 요약</h4>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">출근일수:</span>
                <span className="font-medium text-blue-900">{workSummary.work_days}일</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">총 수업:</span>
                <span className="font-medium text-blue-900">{workSummary.total_classes}회</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">오전/오후/저녁:</span>
                <span className="font-medium text-blue-900">
                  {workSummary.morning_classes} / {workSummary.afternoon_classes} / {workSummary.evening_classes}
                </span>
              </div>
              {workSummary.overtime_hours > 0 && (
                <div className="flex justify-between">
                  <span className="text-blue-700">초과근무:</span>
                  <span className="font-medium text-blue-900">{workSummary.overtime_hours}시간</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!loadingWorkData && !error && instructorId && yearMonth && workSummary && workSummary.total_classes === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              선택한 월에 출근 기록이 없습니다.
            </p>
          </div>
        )}

        <Button
          onClick={handleCalculate}
          disabled={calculating || !instructorId || !yearMonth || loadingWorkData}
          className="w-full"
        >
          {calculating ? '계산 중...' : '급여 계산 및 저장'}
        </Button>
      </CardContent>
    </Card>
  );
}
