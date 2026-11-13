import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { exportsApi } from '@/lib/api/exports';
import { fetchReportSourceData } from './reports-api';
import type { ReportExportType, ReportSourceData } from './reports-types';
import {
  calculateComputedStats,
  calculateReportStats,
  getCurrentYearMonth,
  getExportSuccessMessage,
  getReportDateRange,
  REPORT_EXPORT_ERROR,
  REPORT_LOAD_ERROR,
} from './reports-utils';
import { useBranchChecks } from '@/features/branches/branch-checks';

const EMPTY_SOURCE: ReportSourceData = {
  students: [], payments: [], paidPayments: [], expenses: [], instructors: [], otherIncomes: [],
};

export function useReportsPageState() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [source, setSource] = useState<ReportSourceData>(EMPTY_SOURCE);
  const [branchIds, setBranchIds] = useBranchChecks();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingType, setExportingType] = useState<ReportExportType | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSource(await fetchReportSourceData(selectedMonth));
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
        await exportsApi.downloadRevenue({ start_date: range.startDate, end_date: range.endDate, branch_ids: branchIds });
      }
      if (type === 'expenses') {
        await exportsApi.downloadExpenses({ start_date: range.startDate, end_date: range.endDate });
      }
      if (type === 'payments') {
        await exportsApi.downloadPayments({ year: range.year, month: range.month, branch_ids: branchIds });
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

  const stats = useMemo(() => calculateReportStats(source, branchIds), [branchIds, source]);
  const computed = useMemo(() => calculateComputedStats(stats), [stats]);

  return {
    branchIds,
    computed,
    error,
    exportMenuOpen,
    exportingType,
    loading,
    reload,
    selectedMonth,
    setBranchIds,
    setExportMenuOpen,
    setSelectedMonth,
    stats,
    exportReport,
  };
}
