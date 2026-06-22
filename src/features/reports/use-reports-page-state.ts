import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { exportsApi } from '@/lib/api/exports';
import { fetchReportSourceData } from './reports-api';
import type { ReportExportType, ReportStats } from './reports-types';
import {
  calculateComputedStats,
  calculateReportStats,
  getCurrentYearMonth,
  getExportSuccessMessage,
  getReportDateRange,
  REPORT_EXPORT_ERROR,
  REPORT_LOAD_ERROR,
} from './reports-utils';

const INITIAL_STATS: ReportStats = {
  students: { total: 0, active: 0, paused: 0, avgMonthlyTuition: 0 },
  payments: { total: 0, paid: 0, unpaid: 0, totalAmount: 0, paidAmountFromBilled: 0, paidAmount: 0 },
  expenses: { total: 0, totalAmount: 0 },
  instructors: { total: 0, active: 0 },
  otherIncomes: { total: 0, totalAmount: 0 },
};

export function useReportsPageState() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [stats, setStats] = useState<ReportStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingType, setExportingType] = useState<ReportExportType | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const source = await fetchReportSourceData(selectedMonth);
      setStats(calculateReportStats(source));
    } catch {
      setError(REPORT_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    reload();
  }, [reload]);

  const exportReport = async (type: ReportExportType) => {
    const range = getReportDateRange(selectedMonth);
    setExportingType(type);
    setExportMenuOpen(false);

    try {
      if (type === 'revenue') {
        await exportsApi.downloadRevenue({ start_date: range.startDate, end_date: range.endDate });
      }
      if (type === 'expenses') {
        await exportsApi.downloadExpenses({ start_date: range.startDate, end_date: range.endDate });
      }
      if (type === 'payments') {
        await exportsApi.downloadPayments({ year: range.year, month: range.month });
      }
      if (type === 'financial') {
        await exportsApi.downloadFinancial(range.year);
      }
      toast.success(getExportSuccessMessage(type));
    } catch {
      toast.error(REPORT_EXPORT_ERROR);
    } finally {
      setExportingType(null);
    }
  };

  const computed = useMemo(() => calculateComputedStats(stats), [stats]);

  return {
    computed,
    error,
    exportMenuOpen,
    exportingType,
    loading,
    reload,
    selectedMonth,
    setExportMenuOpen,
    setSelectedMonth,
    stats,
    exportReport,
  };
}
