'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getSalaryDetailForPage,
  recalculateSalaryForPage,
  recordSalaryPayment,
  updateSalaryForPage,
} from './salary-detail-api';
import type { AttendanceSummary, SalaryDetailWithRates } from './salary-detail-types';
import { formatCurrency } from './salary-detail-utils';

const LOAD_ERROR_MESSAGE = '급여 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function useSalaryDetailState(salaryId: number) {
  const [salary, setSalary] = useState<SalaryDetailWithRates | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingIncentive, setEditingIncentive] = useState(false);
  const [incentiveInput, setIncentiveInput] = useState(0);
  const [savingIncentive, setSavingIncentive] = useState(false);

  const loadSalary = useCallback(async () => {
    if (!salaryId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getSalaryDetailForPage(salaryId);
      setSalary(response.salary);
      setAttendanceSummary(response.attendance_summary || null);
    } catch {
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [salaryId]);

  useEffect(() => {
    void loadSalary();
  }, [loadSalary]);

  const requestPayment = () => {
    if (!salary || salary.payment_status === 'paid') return;
    setShowPasswordModal(true);
  };

  const executePayment = async () => {
    setShowPasswordModal(false);
    setPaying(true);
    try {
      await recordSalaryPayment(salaryId);
      toast.success('급여 지급 처리가 완료되었습니다.');
      void loadSalary();
    } catch {
      toast.error('지급 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setPaying(false);
    }
  };

  const recalculate = async () => {
    if (!salary || salary.payment_status !== 'pending') return;
    if (!window.confirm('현재 단가와 출근 기록으로 급여를 재계산하시겠습니까?')) return;
    setRecalculating(true);
    try {
      const result = await recalculateSalaryForPage(salaryId);
      toast.success(`재계산 완료: ${formatCurrency(result.salary.net_salary)}`);
      void loadSalary();
    } catch {
      toast.error('급여 재계산을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setRecalculating(false);
    }
  };

  const startEditIncentive = () => {
    setIncentiveInput(salary?.incentive_amount || 0);
    setEditingIncentive(true);
  };

  const cancelEditIncentive = () => {
    setEditingIncentive(false);
    setIncentiveInput(0);
  };

  const saveIncentive = async () => {
    if (!salary) return;
    const newIncentive = incentiveInput || 0;
    if (newIncentive < 0) {
      toast.error('인센티브는 0원 이상이어야 합니다.');
      return;
    }
    setSavingIncentive(true);
    try {
      await updateSalaryForPage(salaryId, { incentive_amount: newIncentive });
      toast.success('인센티브가 저장되었습니다.');
      setEditingIncentive(false);
      void loadSalary();
    } catch {
      toast.error('인센티브를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSavingIncentive(false);
    }
  };

  return {
    salary,
    attendanceSummary,
    loading,
    error,
    paying,
    recalculating,
    showPasswordModal,
    editingIncentive,
    incentiveInput,
    savingIncentive,
    setShowPasswordModal,
    setIncentiveInput,
    reload: loadSalary,
    requestPayment,
    executePayment,
    recalculate,
    startEditIncentive,
    cancelEditIncentive,
    saveIncentive,
  };
}
