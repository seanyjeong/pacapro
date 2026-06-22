'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { SalaryWithAttendance } from '@/lib/utils/pdf-generator';
import type { Instructor } from '@/lib/types/instructor';
import type { Salary, SalaryFilters } from '@/lib/types/salary';
import {
  bulkPaySalaries,
  downloadSalariesExcel,
  getActiveSalaryInstructors,
  getSalariesForPage,
  getSalaryDetailForPage,
  getSalaryPageSettings,
} from './salaries-page-api';
import { calculateSalarySummary, createDefaultFilters, getCurrentFilterYearMonth } from './salaries-page-utils';

const LOAD_ERROR_MESSAGE = '급여 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function useSalariesPageState() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [filters, setFilters] = useState<SalaryFilters>({});
  const [salaryPayDay, setSalaryPayDay] = useState(10);
  const [salaryMonthType, setSalaryMonthType] = useState<'next' | 'current'>('next');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [bulkPaying, setBulkPaying] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadBaseData() {
      try {
        const [settings, instructorList] = await Promise.all([
          getSalaryPageSettings(),
          getActiveSalaryInstructors(),
        ]);
        if (cancelled) return;
        const monthType = settings.salary_month_type === 'current' ? 'current' : 'next';
        const payDay = settings.salary_payment_day || 10;
        setSalaryPayDay(payDay);
        setSalaryMonthType(monthType);
        setInstructors(instructorList);
        setFilters(createDefaultFilters(payDay, monthType));
      } catch {
        console.error('Salary base data load failed');
        if (!cancelled) setFilters(createDefaultFilters(10, 'next'));
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    }
    void loadBaseData();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSalaries = useCallback(async () => {
    if (!settingsLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getSalariesForPage(filters);
      setSalaries(response.salaries || []);
    } catch {
      console.error('Salaries page data load failed');
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [filters, settingsLoaded]);

  useEffect(() => {
    void loadSalaries();
  }, [loadSalaries]);

  const updateFilters = (newFilters: Partial<SalaryFilters>) => {
    setFilters((current) => {
      const merged = { ...current, ...newFilters };
      Object.keys(merged).forEach((key) => {
        if (merged[key as keyof SalaryFilters] === undefined) delete merged[key as keyof SalaryFilters];
      });
      return merged;
    });
  };

  const goToPrevMonth = () => {
    const year = filters.year || new Date().getFullYear();
    const month = filters.month || new Date().getMonth() + 1;
    updateFilters(month === 1 ? { year: year - 1, month: 12 } : { month: month - 1 });
  };

  const goToNextMonth = () => {
    const year = filters.year || new Date().getFullYear();
    const month = filters.month || new Date().getMonth() + 1;
    updateFilters(month === 12 ? { year: year + 1, month: 1 } : { month: month + 1 });
  };

  const goToDefaultMonth = () => {
    setFilters(createDefaultFilters(salaryPayDay, salaryMonthType));
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadSalariesExcel(filters);
      toast.success('급여 명세서 다운로드가 완료되었습니다.');
    } catch {
      console.error('Salary excel export failed');
      toast.error('급여 명세서를 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    if (salaries.length === 0) {
      toast.error('다운로드할 급여 기록이 없습니다.');
      return;
    }
    setPdfExporting(true);
    setPdfProgress({ current: 0, total: salaries.length });
    try {
      const settings = await getSalaryPageSettings().catch(() => ({ academy_name: 'P-ACA' }));
      const salaryDataList = await Promise.all(
        salaries.map(async (salary) => {
          try {
            const response = await getSalaryDetailForPage(salary.id);
            return {
              salary: response.salary,
              attendance_summary: (response as { attendance_summary?: SalaryWithAttendance['attendance_summary'] }).attendance_summary || null,
            };
          } catch {
            console.error('Salary PDF detail load failed');
            return { salary, attendance_summary: null };
          }
        })
      );
      const { downloadSalariesAsZip } = await import('@/lib/utils/pdf-generator');
      await downloadSalariesAsZip(
        salaryDataList,
        getCurrentFilterYearMonth(filters) || new Date().toISOString().slice(0, 7),
        (current, total) => setPdfProgress({ current, total }),
        settings.academy_name || 'P-ACA'
      );
      toast.success(`PDF ${salaries.length}개 다운로드가 완료되었습니다.`);
    } catch {
      console.error('Salary PDF export failed');
      toast.error('PDF를 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setPdfExporting(false);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  const requestBulkPay = () => {
    if (summary.pendingCount === 0) {
      toast.error('지급 대기 중인 급여가 없습니다.');
      return;
    }
    setShowPasswordModal(true);
  };

  const executeBulkPay = async () => {
    setShowPasswordModal(false);
    setBulkPaying(true);
    try {
      const result = await bulkPaySalaries({ year_month: getCurrentFilterYearMonth(filters) });
      toast.success(result.message || '급여 지급 처리가 완료되었습니다.');
      void loadSalaries();
    } catch {
      console.error('Salary bulk pay failed');
      toast.error('일괄 지급 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBulkPaying(false);
    }
  };

  const summary = useMemo(() => calculateSalarySummary(salaries), [salaries]);

  return {
    salaries,
    instructors,
    filters,
    summary,
    loading,
    error,
    exporting,
    pdfExporting,
    pdfProgress,
    bulkPaying,
    showPasswordModal,
    setShowPasswordModal,
    updateFilters,
    reload: loadSalaries,
    goToPrevMonth,
    goToNextMonth,
    goToDefaultMonth,
    exportExcel,
    exportPDF,
    requestBulkPay,
    executeBulkPay,
  };
}
