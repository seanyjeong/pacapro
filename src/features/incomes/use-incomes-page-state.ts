'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  createOtherIncome,
  deleteOtherIncome,
  downloadRevenue,
  getIncomePageData,
  updateOtherIncome,
} from './incomes-api';
import type { IncomeFormData, IncomeTab, IncomeViewMode, OtherIncome, TuitionPayment } from './incomes-types';
import {
  calculateIncomeSummary,
  createDefaultIncomeFormData,
  filterOtherIncomes,
  filterTuitionPayments,
  getCurrentYearMonth,
  toIncomeFormData,
} from './incomes-utils';

const LOAD_ERROR_MESSAGE = '수입 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function useIncomesPageState() {
  const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([]);
  const [tuitionPayments, setTuitionPayments] = useState<TuitionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<IncomeTab>('all');
  const [viewMode, setViewMode] = useState<IncomeViewMode>('list');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<OtherIncome | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<IncomeFormData>(createDefaultIncomeFormData);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getIncomePageData(selectedMonth);
      setOtherIncomes(data.otherIncomes);
      setTuitionPayments(data.tuitionPayments);
    } catch {
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredTuitionPayments = useMemo(
    () => filterTuitionPayments(tuitionPayments, searchQuery),
    [tuitionPayments, searchQuery]
  );
  const filteredOtherIncomes = useMemo(
    () => filterOtherIncomes(otherIncomes, searchQuery),
    [otherIncomes, searchQuery]
  );
  const summary = useMemo(() => calculateIncomeSummary(tuitionPayments, otherIncomes), [tuitionPayments, otherIncomes]);

  const resetForm = () => {
    setFormData(createDefaultIncomeFormData());
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    if (showForm && !editingId) {
      resetForm();
      return;
    }
    setFormData(createDefaultIncomeFormData());
    setEditingId(null);
    setShowForm(true);
  };

  const updateForm = <K extends keyof IncomeFormData>(key: K, value: IncomeFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const submitForm = async () => {
    try {
      if (editingId) {
        await updateOtherIncome(editingId, formData);
        toast.success('수입이 수정되었습니다.');
      } else {
        await createOtherIncome(formData);
        toast.success('수입이 등록되었습니다.');
      }
      resetForm();
      void loadData();
    } catch {
      toast.error('수입 내역을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해주세요.');
    }
  };

  const editIncome = (income: OtherIncome) => {
    setFormData(toIncomeFormData(income));
    setEditingId(income.id);
    setShowForm(true);
  };

  const removeIncome = async (id: number) => {
    if (!window.confirm('이 수입 내역을 삭제하시겠습니까?')) return;
    try {
      await deleteOtherIncome(id);
      toast.success('삭제되었습니다.');
      void loadData();
    } catch {
      toast.error('수입 내역을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const exportRevenue = async () => {
    setExporting(true);
    try {
      await downloadRevenue(selectedMonth);
      toast.success('수입 내역 다운로드 완료');
    } catch {
      toast.error('수입 내역을 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  };

  return {
    otherIncomes,
    tuitionPayments,
    filteredTuitionPayments,
    filteredOtherIncomes,
    summary,
    loading,
    error,
    exporting,
    activeTab,
    viewMode,
    selectedMonth,
    showForm,
    editingId,
    selectedIncome,
    searchQuery,
    formData,
    setActiveTab,
    setViewMode,
    setSelectedMonth,
    setSelectedIncome,
    setSearchQuery,
    resetForm,
    openCreateForm,
    updateForm,
    submitForm,
    editIncome,
    removeIncome,
    exportRevenue,
    reload: loadData,
  };
}
