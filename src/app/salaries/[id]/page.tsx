'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Printer,
  Edit3,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';
import { salariesAPI } from '@/lib/api/salaries';
import type { SalaryDetail } from '@/lib/types/salary';
import { PAYMENT_STATUS_LABELS, TAX_TYPE_LABELS } from '@/lib/types/salary';
import { SALARY_TYPE_LABELS } from '@/lib/types/instructor';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

interface AttendanceDetail {
  time_slot: string;
  time_slot_label: string;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_status: string;
}

interface DailyBreakdown {
  slots: string[];
  details: AttendanceDetail[];
}

interface AttendanceSummary {
  work_year_month: string;
  attendance_days: number;
  total_classes: number;
  morning_classes: number;
  afternoon_classes: number;
  evening_classes: number;
  total_hours: number;
  daily_breakdown: Record<string, DailyBreakdown>;
}

export default function SalaryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const salaryId = Number(params.id);

  const [salary, setSalary] = useState<SalaryDetail | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // 인센티브 수정 상태
  const [editingIncentive, setEditingIncentive] = useState(false);
  const [incentiveInput, setIncentiveInput] = useState('');
  const [savingIncentive, setSavingIncentive] = useState(false);

  useEffect(() => {
    if (salaryId) {
      loadSalary();
    }
  }, [salaryId]);

  const loadSalary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await salariesAPI.getSalary(salaryId);
      setSalary(response.salary);
      setAttendanceSummary((response as any).attendance_summary || null);
    } catch (err: any) {
      console.error('Failed to load salary:', err);
      setError(err.response?.data?.message || '급여 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!salary || salary.payment_status === 'paid') return;

    const confirmed = window.confirm('이 급여를 지급 완료 처리하시겠습니까?');
    if (!confirmed) return;

    try {
      setPaying(true);
      await salariesAPI.recordPayment(salaryId);
      alert('급여가 지급 완료 처리되었습니다.');
      loadSalary();
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      alert(err.response?.data?.message || '지급 처리에 실패했습니다.');
    } finally {
      setPaying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRecalculate = async () => {
    if (!salary || salary.payment_status !== 'pending') return;

    const confirmed = window.confirm(
      '현재 강사 단가와 출근 기록을 기반으로 급여를 재계산합니다.\n\n' +
      '※ 인센티브와 공제액은 유지됩니다.\n\n계속하시겠습니까?'
    );
    if (!confirmed) return;

    try {
      setRecalculating(true);
      const result = await salariesAPI.recalculateSalary(salaryId);
      alert(
        `급여가 재계산되었습니다.\n\n` +
        `기본급: ${new Intl.NumberFormat('ko-KR').format(result.salary.base_amount)}원\n` +
        `실수령액: ${new Intl.NumberFormat('ko-KR').format(result.salary.net_salary)}원`
      );
      loadSalary();
    } catch (err: any) {
      console.error('Failed to recalculate salary:', err);
      alert(err.response?.data?.message || '급여 재계산에 실패했습니다.');
    } finally {
      setRecalculating(false);
    }
  };

  // 인센티브 수정 시작
  const startEditIncentive = () => {
    setIncentiveInput(salary?.incentive_amount?.toString() || '0');
    setEditingIncentive(true);
  };

  // 인센티브 수정 취소
  const cancelEditIncentive = () => {
    setEditingIncentive(false);
    setIncentiveInput('');
  };

  // 인센티브 저장
  const saveIncentive = async () => {
    if (!salary) return;

    const newIncentive = parseFloat(incentiveInput) || 0;
    if (newIncentive < 0) {
      alert('인센티브는 0 이상이어야 합니다.');
      return;
    }

    try {
      setSavingIncentive(true);
      await salariesAPI.updateSalary(salaryId, { incentive_amount: newIncentive });
      setEditingIncentive(false);
      loadSalary(); // 새로고침
    } catch (err: any) {
      console.error('Failed to update incentive:', err);
      alert(err.response?.data?.message || '인센티브 수정에 실패했습니다.');
    } finally {
      setSavingIncentive(false);
    }
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">급여 명세서</h1>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 에러 화면
  if (error || !salary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">급여 명세서</h1>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error || '급여 정보를 찾을 수 없습니다.'}</p>
            <Button variant="outline" onClick={() => router.back()}>뒤로 가기</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const salaryTypeLabel = SALARY_TYPE_LABELS[(salary as any).salary_type as keyof typeof SALARY_TYPE_LABELS] || (salary as any).salary_type || '-';
  const hourlyRate = parseFloat((salary as any).hourly_rate) || 0;
  const morningRate = parseFloat((salary as any).morning_class_rate) || 0;
  const afternoonRate = parseFloat((salary as any).afternoon_class_rate) || 0;
  const eveningRate = parseFloat((salary as any).evening_class_rate) || 0;

  return (
    <>
      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-container {
            max-width: 100% !important;
            padding: 0 !important;
          }
          .print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-compact {
            padding: 4px 8px !important;
            font-size: 11px !important;
          }
          .print-table td, .print-table th {
            padding: 2px 6px !important;
            font-size: 10px !important;
          }
          .print-title {
            font-size: 18px !important;
            margin-bottom: 8px !important;
          }
          .print-gap {
            gap: 8px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-4 max-w-4xl mx-auto print-container">
        {/* 헤더 (화면용) */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">급여 명세서</h1>
              <p className="text-gray-600 text-sm">{salary.year_month}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              인쇄
            </Button>
            {salary.payment_status === 'pending' && (
              <>
                <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${recalculating ? 'animate-spin' : ''}`} />
                  {recalculating ? '재계산 중...' : '재계산'}
                </Button>
                <Button size="sm" onClick={handlePayment} disabled={paying}>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {paying ? '처리 중...' : '지급 완료'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 인쇄용 헤더 */}
        <div className="hidden print:block text-center border-b-2 border-gray-800 pb-3 mb-4">
          <h1 className="text-xl font-bold print-title">급 여 명 세 서</h1>
          <p className="text-sm text-gray-600">{salary.year_month} ({attendanceSummary?.work_year_month} 근무분)</p>
        </div>

        {/* 기본 정보 */}
        <div className="print-section border rounded-lg p-3 print-compact">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 print-gap text-sm">
            <div>
              <span className="text-gray-500">강사명:</span>
              <span className="ml-2 font-semibold">{salary.instructor_name}</span>
            </div>
            <div>
              <span className="text-gray-500">급여유형:</span>
              <span className="ml-2 font-semibold">{salaryTypeLabel}</span>
            </div>
            <div>
              <span className="text-gray-500">급여월:</span>
              <span className="ml-2 font-semibold">{salary.year_month}</span>
            </div>
            <div className="no-print">
              <span className="text-gray-500">상태:</span>
              <span className={`ml-2 font-semibold ${salary.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                {PAYMENT_STATUS_LABELS[salary.payment_status]}
              </span>
            </div>
          </div>
        </div>

        {/* 단가 정보 */}
        {((salary as any).salary_type === 'per_class' || (salary as any).salary_type === 'hourly') && (
          <div className="print-section border rounded-lg p-3 print-compact bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">단가 정보</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 print-gap text-sm">
              {(salary as any).salary_type === 'hourly' && hourlyRate > 0 && (
                <div>
                  <span className="text-gray-500">시급:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(hourlyRate)}</span>
                </div>
              )}
              {(salary as any).salary_type === 'per_class' && (
                <>
                  {morningRate > 0 && (
                    <div>
                      <span className="text-gray-500">오전:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(morningRate)}/회</span>
                    </div>
                  )}
                  {afternoonRate > 0 && (
                    <div>
                      <span className="text-gray-500">오후:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(afternoonRate)}/회</span>
                    </div>
                  )}
                  {eveningRate > 0 && (
                    <div>
                      <span className="text-gray-500">저녁:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(eveningRate)}/회</span>
                    </div>
                  )}
                  {morningRate === 0 && afternoonRate === 0 && eveningRate === 0 && hourlyRate > 0 && (
                    <div>
                      <span className="text-gray-500">수업당:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(hourlyRate)}/회</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 출근 내역 */}
        {attendanceSummary && Object.keys(attendanceSummary.daily_breakdown).length > 0 && (
          <div className="print-section border rounded-lg overflow-hidden">
            <div className="bg-blue-50 p-2 print-compact border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-blue-800">
                  {attendanceSummary.work_year_month} 출근 내역
                </h3>
                <div className="text-xs text-blue-700 space-x-3">
                  <span>출근 {attendanceSummary.attendance_days}일</span>
                  <span>|</span>
                  <span>총 {attendanceSummary.total_classes}회</span>
                  <span className="text-blue-600">
                    (오전 {attendanceSummary.morning_classes} / 오후 {attendanceSummary.afternoon_classes} / 저녁 {attendanceSummary.evening_classes})
                  </span>
                </div>
              </div>
            </div>
            <table className="w-full text-xs print-table">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 w-16">날짜</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 w-10">요일</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600">시간대</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 w-16">출근</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 w-16">퇴근</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(attendanceSummary.daily_breakdown)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, data]) => {
                    const dateObj = new Date(date);
                    const month = dateObj.getMonth() + 1;
                    const day = dateObj.getDate();
                    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                    const dayOfWeek = dayNames[dateObj.getDay()];
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                    return data.details.map((detail, idx) => (
                      <tr key={`${date}-${idx}`} className={isWeekend ? 'bg-red-50' : ''}>
                        {idx === 0 && (
                          <>
                            <td className="px-2 py-1 font-medium" rowSpan={data.details.length}>
                              {month}/{day}
                            </td>
                            <td className={`px-2 py-1 ${isWeekend ? 'text-red-600' : ''}`} rowSpan={data.details.length}>
                              {dayOfWeek}
                            </td>
                          </>
                        )}
                        <td className="px-2 py-1">{detail.time_slot_label}</td>
                        <td className="px-2 py-1 text-gray-500">{detail.check_in_time || '-'}</td>
                        <td className="px-2 py-1 text-gray-500">{detail.check_out_time || '-'}</td>
                      </tr>
                    ));
                  })}
              </tbody>
            </table>
            {attendanceSummary.total_hours > 0 && (
              <div className="px-2 py-1 text-right text-xs text-gray-600 bg-gray-50 border-t">
                총 근무시간: <span className="font-semibold">{attendanceSummary.total_hours}시간</span>
              </div>
            )}
          </div>
        )}

        {/* 급여 계산 내역 */}
        <div className="print-section border rounded-lg overflow-hidden">
          <div className="bg-emerald-50 p-2 print-compact border-b">
            <h3 className="text-sm font-semibold text-emerald-800">급여 계산</h3>
          </div>
          <div className="p-3 print-compact space-y-2 text-sm">
            {/* 계산식 */}
            {attendanceSummary && (salary as any).salary_type === 'per_class' && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-2">
                {morningRate > 0 && attendanceSummary.morning_classes > 0 && (
                  <div>오전: {formatCurrency(morningRate)} × {attendanceSummary.morning_classes}회 = {formatCurrency(morningRate * attendanceSummary.morning_classes)}</div>
                )}
                {afternoonRate > 0 && attendanceSummary.afternoon_classes > 0 && (
                  <div>오후: {formatCurrency(afternoonRate)} × {attendanceSummary.afternoon_classes}회 = {formatCurrency(afternoonRate * attendanceSummary.afternoon_classes)}</div>
                )}
                {eveningRate > 0 && attendanceSummary.evening_classes > 0 && (
                  <div>저녁: {formatCurrency(eveningRate)} × {attendanceSummary.evening_classes}회 = {formatCurrency(eveningRate * attendanceSummary.evening_classes)}</div>
                )}
              </div>
            )}
            {attendanceSummary && (salary as any).salary_type === 'hourly' && hourlyRate > 0 && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-2">
                시급 {formatCurrency(hourlyRate)} × {attendanceSummary.total_hours}시간 = {formatCurrency(hourlyRate * attendanceSummary.total_hours)}
              </div>
            )}

            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-600">기본급</span>
              <span className="font-medium">{formatCurrency(salary.base_amount)}</span>
            </div>
            {/* 인센티브 - 항상 표시 (수정 가능) */}
            <div className="flex justify-between py-1 border-b items-center">
              <span className="text-gray-600">인센티브</span>
              {editingIncentive ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={incentiveInput}
                    onChange={(e) => setIncentiveInput(e.target.value)}
                    className="w-32 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                    min="0"
                    step="10000"
                    autoFocus
                  />
                  <span className="text-sm text-gray-500">원</span>
                  <button
                    onClick={saveIncentive}
                    disabled={savingIncentive}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditIncentive}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${salary.incentive_amount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {salary.incentive_amount > 0 ? `+${formatCurrency(salary.incentive_amount)}` : '0원'}
                  </span>
                  {salary.payment_status === 'pending' && (
                    <button
                      onClick={startEditIncentive}
                      className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded no-print"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {salary.total_deduction > 0 && (
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600">공제액</span>
                <span className="font-medium text-red-600">-{formatCurrency(salary.total_deduction)}</span>
              </div>
            )}
            {/* 4대보험 상세 내역 */}
            {(salary.tax_type === 'insurance' || salary.tax_type === 'freelancer') && salary.insurance_details ? (() => {
              const details = typeof salary.insurance_details === 'string'
                ? JSON.parse(salary.insurance_details)
                : salary.insurance_details;
              return (
                <div className="py-1 border-b">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 font-medium">4대보험 공제 내역</span>
                    <span className="font-medium text-red-600">-{formatCurrency(salary.tax_amount)}</span>
                  </div>
                  <div className="pl-4 space-y-1 text-sm bg-red-50 rounded p-2 -mx-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">국민연금 (4.5%)</span>
                      <span className="text-red-600">{formatCurrency(details.nationalPension || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">건강보험 (3.545%)</span>
                      <span className="text-red-600">{formatCurrency(details.healthInsurance || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">장기요양보험</span>
                      <span className="text-red-600">{formatCurrency(details.longTermCare || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">고용보험 (0.9%)</span>
                      <span className="text-red-600">{formatCurrency(details.employmentInsurance || 0)}</span>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="flex justify-between py-1 border-b">
                <span className="text-gray-600">세금 ({TAX_TYPE_LABELS[salary.tax_type] || salary.tax_type})</span>
                <span className="font-medium text-red-600">-{formatCurrency(salary.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 bg-blue-50 -mx-3 px-3 rounded mt-2">
              <span className="font-bold text-gray-900">실수령액</span>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(salary.net_salary)}</span>
            </div>
          </div>
        </div>

        {/* 지급 정보 */}
        {salary.payment_status === 'paid' && salary.payment_date && (
          <div className="print-section border rounded-lg p-3 print-compact bg-green-50">
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-700 font-medium">지급 완료</span>
              <span className="text-green-800 font-semibold">
                {new Date(salary.payment_date).toLocaleDateString('ko-KR')}
              </span>
            </div>
          </div>
        )}

        {/* 하단 버튼 (화면용) */}
        <div className="flex justify-between no-print pt-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            목록
          </Button>
          {salary.payment_status === 'pending' && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
                <RefreshCw className={`w-4 h-4 mr-1 ${recalculating ? 'animate-spin' : ''}`} />
                {recalculating ? '재계산 중...' : '재계산'}
              </Button>
              <Button size="sm" onClick={handlePayment} disabled={paying}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {paying ? '처리 중...' : '지급 완료'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
