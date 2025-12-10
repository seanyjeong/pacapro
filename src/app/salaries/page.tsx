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
import { calculateTotalPaid, calculateTotalUnpaid } from '@/lib/utils/salary-helpers';
import { PasswordConfirmModal } from '@/components/modals/password-confirm-modal';
// PDF 유틸리티는 동적 import로 필요할 때만 로드
import { toast } from 'sonner';

/**
 * 급여일 기준으로 보여줄 급여 월을 계산
 *
 * 익월 정산(next): 이번 달 급여일에 전달 근무분을 지급
 * - 12월 2일 (급여일 10일 전): 이번 달에 지급할 11월분 표시
 * - 12월 15일 (급여일 10일 후): 이번 달에 지급한 11월분 표시
 *
 * 당월 정산(current): 이번 달 급여일에 당월 근무분을 지급
 * - 12월 2일 (급여일 10일 전): 이번 달에 지급할 12월분 표시
 * - 12월 15일 (급여일 10일 후): 이번 달에 지급한 12월분 표시
 */
function calculateDefaultYearMonth(salaryPayDay: number, salaryMonthType: 'next' | 'current'): { year: number; month: number } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  if (salaryMonthType === 'next') {
    // 익월 정산: 이번 달 급여일에 전달 근무분 지급
    // 12월 → 11월분 표시
    const targetMonth = currentMonth - 1;
    if (targetMonth <= 0) {
      return { year: currentYear - 1, month: 12 };
    }
    return { year: currentYear, month: targetMonth };
  } else {
    // 당월 정산: 이번 달 급여일에 당월 근무분 지급
    // 12월 → 12월분 표시
    return { year: currentYear, month: currentMonth };
  }
}

export default function SalariesPage() {
  const router = useRouter();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [salaryPayDay, setSalaryPayDay] = useState(10);
  const [salaryMonthType, setSalaryMonthType] = useState<'next' | 'current'>('next');

  // 초기 필터는 설정 로드 후 계산
  const initialFilters = useMemo(() => {
    if (!settingsLoaded) return {};
    const { year, month } = calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
    return { year, month };
  }, [settingsLoaded, salaryPayDay, salaryMonthType]);

  const { salaries, loading, error, filters, updateFilters, resetFilters, reload, setFilters } = useSalaries();
  const [instructors, setInstructors] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [bulkPaying, setBulkPaying] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // 설정 로드 및 초기 필터 설정
  useEffect(() => {
    loadSettings();
    loadInstructors();
  }, []);

  // 설정 로드 후 초기 필터 적용
  useEffect(() => {
    if (settingsLoaded && !filters.year && !filters.month) {
      const { year, month } = calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
      setFilters({ ...filters, year, month });
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

  // 이전 월로 이동
  const goToPrevMonth = () => {
    const year = filters.year || new Date().getFullYear();
    const month = filters.month || new Date().getMonth() + 1;
    if (month === 1) {
      updateFilters({ year: year - 1, month: 12 });
    } else {
      updateFilters({ month: month - 1 });
    }
  };

  // 다음 월로 이동
  const goToNextMonth = () => {
    const year = filters.year || new Date().getFullYear();
    const month = filters.month || new Date().getMonth() + 1;
    if (month === 12) {
      updateFilters({ year: year + 1, month: 1 });
    } else {
      updateFilters({ month: month + 1 });
    }
  };

  // 현재(기본) 월로 이동
  const goToDefaultMonth = () => {
    const { year, month } = calculateDefaultYearMonth(salaryPayDay, salaryMonthType);
    setFilters({ ...filters, year, month, instructor_id: undefined, payment_status: undefined });
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

  // 비밀번호 확인 후 일괄 지급 처리 실행
  const handleBulkPay = () => {
    if (pendingCount === 0) {
      toast.error('지급 대기 중인 급여가 없습니다');
      return;
    }
    // 비밀번호 확인 모달 열기
    setShowPasswordModal(true);
  };

  // 비밀번호 확인 후 실제 일괄 지급 처리
  const executeBulkPay = async () => {
    setShowPasswordModal(false);

    try {
      setBulkPaying(true);
      const yearMonth = filters.year && filters.month
        ? `${filters.year}-${String(filters.month).padStart(2, '0')}`
        : undefined;

      const result = await salariesAPI.bulkRecordPayment({
        year_month: yearMonth,
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
  const pendingCount = salaries.filter((s) => s.payment_status === 'pending').length;
  const totalPaid = calculateTotalPaid(salaries);
  const totalUnpaid = calculateTotalUnpaid(salaries);

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
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}건</p>
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

      {/* 안내 메시지 */}
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

      {/* 필터 */}
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

            {/* 월 네비게이션 */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToDefaultMonth} className="min-w-[120px]">
                {filters.year && filters.month ? `${filters.year}년 ${filters.month}월` : '전체'}
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
                disabled={bulkPaying || pendingCount === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {bulkPaying ? (
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                모두 지급처리 ({pendingCount}건)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SalaryList salaries={salaries} loading={loading} onSalaryClick={handleSalaryClick} />

      {/* 비밀번호 확인 모달 */}
      <PasswordConfirmModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onConfirm={executeBulkPay}
        title="급여 지급 확인"
        description={`${pendingCount}건의 급여를 모두 지급 처리합니다. (총 ${totalUnpaid.toLocaleString()}원)\n비밀번호를 입력해주세요.`}
      />
    </div>
  );
}
