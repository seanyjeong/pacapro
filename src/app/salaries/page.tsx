'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Banknote, RefreshCw, FileSpreadsheet, FileDown } from 'lucide-react';
import { SalaryList } from '@/components/salaries/salary-list';
import { useSalaries } from '@/hooks/use-salaries';
import { instructorsAPI } from '@/lib/api/instructors';
import { exportsApi } from '@/lib/api/exports';
import { salariesAPI } from '@/lib/api/salaries';
import apiClient from '@/lib/api/client';
import { PAYMENT_STATUS_OPTIONS } from '@/lib/types/salary';
import { calculateTotalPaid, calculateTotalUnpaid } from '@/lib/utils/salary-helpers';
// PDF 유틸리티는 동적 import로 필요할 때만 로드
import { toast } from 'sonner';

export default function SalariesPage() {
  const router = useRouter();
  const { salaries, loading, error, filters, updateFilters, resetFilters, reload } = useSalaries();
  const [instructors, setInstructors] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadInstructors();
  }, []);

  const loadInstructors = async () => {
    try {
      const data = await instructorsAPI.getInstructors({ status: 'active' });
      setInstructors(data.instructors);
    } catch (err) {
      console.error('Failed to load instructors:', err);
    }
  };

  const handleSalaryClick = (id: number) => {
    router.push(`/salaries/${id}`);
  };

  const handleExportSalaries = async () => {
    try {
      setExporting(true);
      await exportsApi.downloadSalaries({
        year: filters.year,
        month: filters.month,
        payment_status: 'paid', // 지급완료된 것만
      });
      toast.success('급여 명세서 다운로드 완료');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('다운로드 실패');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (salaries.length === 0) {
      toast.error('다운로드할 급여 기록이 없습니다');
      return;
    }

    try {
      setPdfExporting(true);
      setPdfProgress({ current: 0, total: salaries.length });

      // 학원명 가져오기
      let academyName = 'P-ACA';
      try {
        const settingsResponse = await apiClient.get<{ settings: { academy_name: string } }>('/settings/academy');
        academyName = settingsResponse.settings?.academy_name || 'P-ACA';
      } catch (err) {
        console.error('Failed to load academy name:', err);
      }

      // 각 급여의 상세 정보(출근 기록 포함) 가져오기
      const salaryDataList = await Promise.all(
        salaries.map(async (salary) => {
          try {
            const response = await salariesAPI.getSalary(salary.id);
            return {
              salary: response.salary,
              attendance_summary: (response as any).attendance_summary || null,
            };
          } catch (err) {
            console.error(`Failed to load salary ${salary.id}:`, err);
            return {
              salary: salary as any,
              attendance_summary: null,
            };
          }
        })
      );

      const yearMonth = filters.year && filters.month
        ? `${filters.year}-${String(filters.month).padStart(2, '0')}`
        : new Date().toISOString().slice(0, 7);

      // 동적 import로 PDF 유틸리티 로드 (번들 크기 최적화)
      const { downloadSalariesAsZip } = await import('@/lib/utils/pdf-generator');
      await downloadSalariesAsZip(
        salaryDataList,
        yearMonth,
        (current, total) => setPdfProgress({ current, total }),
        academyName
      );

      toast.success(`PDF ${salaries.length}개 다운로드 완료`);
    } catch (error) {
      console.error('PDF Export failed:', error);
      toast.error('PDF 다운로드 실패');
    } finally {
      setPdfExporting(false);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">급여 관리</h1>
          <p className="text-gray-600 mt-1">강사 급여 관리</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={reload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paidCount = salaries.filter((s) => s.payment_status === 'paid').length;
  const pendingCount = salaries.filter((s) => s.payment_status === 'pending').length;
  const totalPaid = calculateTotalPaid(salaries);
  const totalUnpaid = calculateTotalUnpaid(salaries);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">급여 관리</h1>
          <p className="text-gray-600 mt-1">
            강사 출근 체크 시 급여가 자동으로 계산됩니다
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} disabled={pdfExporting || salaries.length === 0}>
            {pdfExporting ? (
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span>{pdfProgress.current}/{pdfProgress.total}</span>
              </div>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                PDF 다운로드
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleExportSalaries} disabled={exporting}>
            {exporting ? (
              <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            엑셀
          </Button>
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">총 급여 기록</p>
                <p className="text-2xl font-bold text-gray-900">{salaries.length}건</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Banknote className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">지급 완료</p>
                <p className="text-2xl font-bold text-green-600">{paidCount}건</p>
                <p className="text-xs text-gray-500 mt-1">{totalPaid.toLocaleString()}원</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Banknote className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">미지급</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}건</p>
                <p className="text-xs text-gray-500 mt-1">{totalUnpaid.toLocaleString()}원</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-gray-600">총 지급액</p>
              <p className="text-2xl font-bold text-gray-900">{totalPaid.toLocaleString()}원</p>
              <p className="text-xs text-gray-500 mt-1">이번 달 기준</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 안내 메시지 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Banknote className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">급여 자동 계산</h4>
              <p className="text-sm text-blue-700 mt-1">
                강사 출근 체크 시 급여가 자동으로 계산되어 아래 목록에 표시됩니다.
                급여 상세를 클릭하면 출근 내역과 함께 급여 명세서를 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 필터 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">강사</label>
              <select
                value={filters.instructor_id || ''}
                onChange={(e) => updateFilters({ instructor_id: e.target.value ? Number(e.target.value) : undefined })}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="">전체</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">지급 상태</label>
              <select
                value={filters.payment_status || ''}
                onChange={(e) => updateFilters({ payment_status: e.target.value as any })}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="">전체</option>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">급여월</label>
              <input
                type="month"
                value={filters.year && filters.month ? `${filters.year}-${String(filters.month).padStart(2, '0')}` : ''}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  updateFilters({ year: parseInt(year), month: parseInt(month) });
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <Button variant="outline" onClick={resetFilters} className="ml-auto">
              필터 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      <SalaryList salaries={salaries} loading={loading} onSalaryClick={handleSalaryClick} />
    </div>
  );
}
