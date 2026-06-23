'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  completeRefund,
  createExpense,
  deleteExpense,
  downloadExpenses,
  getExpenses,
  updateExpense,
} from './expenses-api';
import type { Expense, ExpenseFormData, ExpenseViewMode } from './expenses-types';
import {
  calculateExpenseSummary,
  createDefaultExpenseFormData,
  filterExpenses,
  getCurrentYearMonth,
  toExpenseFormData,
} from './expenses-utils';

const LOAD_ERROR_MESSAGE = '지출 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function useExpensesPageState() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ExpenseViewMode>('list');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<ExpenseFormData>(createDefaultExpenseFormData);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExpenses(await getExpenses(selectedMonth));
    } catch {
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const filteredExpenses = useMemo(() => filterExpenses(expenses, searchQuery), [expenses, searchQuery]);
  const summary = useMemo(() => calculateExpenseSummary(expenses), [expenses]);

  const resetForm = () => {
    setFormData(createDefaultExpenseFormData());
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    if (showForm && !editingId) {
      resetForm();
      return;
    }
    setFormData(createDefaultExpenseFormData());
    setEditingId(null);
    setShowForm(true);
  };

  const updateForm = <K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const submitForm = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateExpense(editingId, formData);
        toast.success('지출이 수정되었습니다.');
      } else {
        await createExpense(formData);
        toast.success('지출이 등록되었습니다.');
      }
      resetForm();
      void loadExpenses();
    } catch {
      toast.error('지출 내역을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const editExpense = (expense: Expense) => {
    setFormData(toExpenseFormData(expense));
    setEditingId(expense.id);
    setShowForm(true);
  };

  const removeExpense = async (id: number) => {
    setActionBusy(true);
    try {
      await deleteExpense(id);
      toast.success('삭제되었습니다.');
      void loadExpenses();
      return true;
    } catch {
      toast.error('지출 내역을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const completeRefundExpense = async (id: number, paymentMethod = 'cash') => {
    setActionBusy(true);
    try {
      await completeRefund(id, paymentMethod);
      toast.success('환불이 완료 처리되었습니다.');
      void loadExpenses();
      return true;
    } catch {
      toast.error('환불 완료 처리를 하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const exportExpenses = async () => {
    setExporting(true);
    try {
      await downloadExpenses();
      toast.success('지출 내역 다운로드 완료');
    } catch {
      toast.error('지출 내역을 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  };

  return {
    expenses,
    filteredExpenses,
    summary,
    loading,
    error,
    exporting,
    saving,
    actionBusy,
    showForm,
    editingId,
    viewMode,
    selectedExpense,
    selectedMonth,
    searchQuery,
    formData,
    setViewMode,
    setSelectedExpense,
    setSelectedMonth,
    setSearchQuery,
    resetForm,
    openCreateForm,
    updateForm,
    submitForm,
    editExpense,
    removeExpense,
    completeRefundExpense,
    exportExpenses,
    reload: loadExpenses,
  };
}
