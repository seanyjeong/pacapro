'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Banknote, RefreshCw, FileSpreadsheet, FileDown, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { SalaryList } from '@/components/salaries/salary-list';
import { useSalaries } from '@/hooks/use-salaries';
import { instructorsAPI } from '@/lib/api/instructors';
import { exportsApi } from '@/lib/api/exports';
import { salariesAPI } from '@/lib/api/salaries';
import apiClient from '@/lib/api/client';
import { PAYMENT_STATUS_OPTIONS } from '@/lib/types/salary';
import { calculateTotalPaid, calculateTotalUnpaid, getPrevYearMonth, getNextYearMonth } from '@/lib/utils/salary-helpers';
import { PasswordConfirmModal } from '@/components/modals/password-confirm-modal';
import { toast } from 'sonner';

/**
 * 급여일 기준으로 보여줄 급여 월을 계산 (YYYY-MM 반환)
 */
function calculateDefaultYearMonth(salaryPayDay: number, salaryMonthType: 'next' | 'current'): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (salaryMonthType === 'next') {
    const targetMonth = currentMonth - 1;
    if (targetMonth <= 0) {
      return `${currentYear - 1}-12`;
    }
    return `${currentYear}-${String(targetMonth).padStart(2, '0')}`;
  } else {
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  }
}

export default function SalariesPage() {
  const router = useRouter();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [salaryPayDay, setSalaryPayDay] = useState(10);
  const [salaryMonthType, setSalaryMonthType] = useState<'next' | 'current'>('next');

  const { salaries, loading, error, filters, updateFilters, reload, setFilters } = useSalaries();
  const [instructors, setInstructors] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [bulkPaying, setBulkPaying] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    loadSettings();
    loadInstructors();
  }, []);

  // Apply default year_month filter after settings load
  useEffect(() => {
    if (settingsLoaded && !filters.year_month) {
      const defaultYm = calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
      setFilters({ ...filters, year_month: defaultYm });
    }
  }, [settingsLoaded, salaryPayDay, salaryMonthType]);

  const loadSettings = async () => {
    try {
      const response = await apiClient.get<{ settings: { salary_payment_day?: number; salary_month_type?: string } }>('/settings/academy');
      if (response.settings) {
        setSalaryPayDay(response.settings.salary_payment_day || 10);
        setSalaryMonthType((response.settings.salary_month_type as 'next' | 'current') || 'next');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoaded(true);
    }
  };

  const loadInstructors = async () => {
    try {
      const data = await instructorsAPI.getInstructors({ status: 'active' });
      setInstructors(data.instructors);
    } catch (err) {
      console.error('Failed to load instructors:', err);
    }
  };

  const goToPrevMonth = () => {
    const ym = filters.year_month || calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
    updateFilters({ year_month: getPrevYearMonth(ym) });
  };

  const goToNextMonth = () => {
    const ym = filters.year_month || calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
    updateFilters({ year_month: getNextYearMonth(ym) });
  };

  const goToDefaultMonth = () => {
    const defaultYm = calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
    setFilters({ year_month: defaultYm });
  };

  const handleSalaryClick = (id: number) => {
    router.push(`/salaries/${id}`);
  };

  const handleExportSalaries = async () => {
    try {
      setExporting(true);
      const ym = filters.year_month;
      const [year, month] = ym ? ym.split('-').map(Number) : [undefined, undefined];
      await exportsApi.downloadSalaries({
        year,
        month,
        payment_status: 'paid',
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

      let academyName = 'P-ACA';
      try {
        const settingsResponse = await apiClient.get<{ settings: { academy_name: string } }>('/settings/academy');
        academyName = settingsResponse.settings?.academy_name || 'P-ACA';
      } catch (err) {
        console.error('Failed to load academy name:', err);
      }

      const salaryDataList = await Promise.all(
        salaries.map(async (salary) => {
          try {
            const salaryDetail = await salariesAPI.getSalary(salary.id);
            return {
              salary: salaryDetail,
              attendance_summary: (salaryDetail as any).attendance_summary || null,
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

      const yearMonth = filters.year_month || new Date().toISOString().slice(0, 7);

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

  const handleBulkPay = () => {
    if (unpaidCount === 0) {
      toast.error('지급 대기 중인 급여가 없습니다');
      return;
    }
    setShowPasswordModal(true);
  };

  const executeBulkPay = async () => {
    setShowPasswordModal(false);

    try {
      setBulkPaying(true);
      const unpaidIds = salaries
        .filter((s) => s.payment_status !== 'paid')
        .map((s) => s.id);

      const today = new Date().toISOString().split('T')[0];
      const result = await salariesAPI.bulkRecordPayment({
        salary_ids: unpaidIds,
        paid_date: today,
      });

      toast.success(result.message);
      reload();
    } catch (error) {
      console.error('Bulk pay failed:', error);
      toast.error('일괄 지급 처리 실패');
    } finally {
      setBulkPaying(false);
    }
  };

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">급여 관리</h1>
          <p className="text-muted-foreground mt-1">강사 급여 관리</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={reload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paidCount = salaries.filter((s) => s.payment_status === 'paid').length;
  const unpaidCount = salaries.filter((s) => s.payment_status !== 'paid').length;
  const totalPaid = calculateTotalPaid(salaries);
  const totalUnpaid = calculateTotalUnpaid(salaries);

  // Display year_month as readable text
  const displayYearMonth = (() => {
    const ym = filters.year_month;
    if (!ym) return '전체';
    const [y, m] = ym.split('-');
    return `${y}년 ${parseInt(m)}월`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">급여 관리</h1>
          <p className="text-muted-foreground mt-1">
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
                <p className="text-sm text-muted-foreground">총 급여 기록</p>
                <p className="text-2xl font-bold text-foreground">{salaries.length}건</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <Banknote className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">지급 완료</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{paidCount}건</p>
                <p className="text-xs text-muted-foreground mt-1">{totalPaid.toLocaleString()}원</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Banknote className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">미지급</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{unpaidCount}건</p>
                <p className="text-xs text-muted-foreground mt-1">{totalUnpaid.toLocaleString()}원</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-muted-foreground">총 지급액</p>
              <p className="text-2xl font-bold text-foreground">{totalPaid.toLocaleString()}원</p>
              <p className="text-xs text-muted-foreground mt-1">이번 달 기준</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guide */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
              <Banknote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">급여 자동 계산</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                강사 출근 체크 시 급여가 자동으로 계산되어 아래 목록에 표시됩니다.
                급여 상세를 클릭하면 출근 내역과 함께 급여 명세서를 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">강사</label>
              <select
                value={filters.instructor_id || ''}
                onChange={(e) => updateFilters({ instructor_id: e.target.value ? Number(e.target.value) : undefined })}
                className="px-3 py-1 border border-border rounded-md text-sm bg-card text-foreground"
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
              <label className="text-sm text-muted-foreground">지급 상태</label>
              <select
                value={filters.payment_status || ''}
                onChange={(e) => updateFilters({ payment_status: e.target.value as any })}
                className="px-3 py-1 border border-border rounded-md text-sm bg-card text-foreground"
              >
                <option value="">전체</option>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToDefaultMonth} className="min-w-[120px]">
                {displayYearMonth}
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={goToDefaultMonth}>
                오늘 기준
              </Button>
              <Button
                variant="default"
                onClick={handleBulkPay}
                disabled={bulkPaying || unpaidCount === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {bulkPaying ? (
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                모두 지급처리 ({unpaidCount}건)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SalaryList salaries={salaries} loading={loading} onSalaryClick={handleSalaryClick} />

      <PasswordConfirmModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onConfirm={executeBulkPay}
        title="급여 지급 확인"
        description={`${unpaidCount}건의 급여를 모두 지급 처리합니다. (총 ${totalUnpaid.toLocaleString()}원)\n비밀번호를 입력해주세요.`}
      />
    </div>
  );
}
