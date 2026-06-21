'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, List } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { studentsAPI } from '@/lib/api/students';
import type { CreditInputMode, MainTab, ManualCredit, ManualCreditModalProps } from './manual-credit-types';
import { ManualCreditApplyDialog } from './manual-credit-apply-dialog';
import { ManualCreditCreateForm } from './manual-credit-create-form';
import { ManualCreditList } from './manual-credit-list';
import { DAY_NAMES, countClassDaysInPeriod, getApiErrorMessage } from './manual-credit-utils';

export function ManualCreditModal({
  open,
  onClose,
  studentId,
  studentName,
  monthlyTuition,
  weeklyCount,
  classDays,
  onSuccess,
}: ManualCreditModalProps) {
  const [mainTab, setMainTab] = useState<MainTab>('create');
  const [inputMode, setInputMode] = useState<CreditInputMode>('date');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [classCount, setClassCount] = useState(1);
  const [directAmount, setDirectAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<ManualCredit[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [editingCredit, setEditingCredit] = useState<ManualCredit | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [applyingCredit, setApplyingCredit] = useState<ManualCredit | null>(null);
  const [applyYearMonth, setApplyYearMonth] = useState('');
  const [applying, setApplying] = useState(false);

  const perClassFee = useMemo(() => {
    const fee = monthlyTuition / (weeklyCount * 4);
    return Math.floor(fee / 1000) * 1000;
  }, [monthlyTuition, weeklyCount]);

  const dateCalculation = useMemo(() => {
    if (!startDate || !endDate || classDays.length === 0) {
      return { count: 0, dates: [], totalCredit: 0 };
    }

    const result = countClassDaysInPeriod(startDate, endDate, classDays);
    return {
      ...result,
      totalCredit: Math.floor((perClassFee * result.count) / 1000) * 1000,
    };
  }, [startDate, endDate, classDays, perClassFee]);

  const countCalculation = useMemo(() => ({
    count: classCount,
    totalCredit: Math.floor((perClassFee * classCount) / 1000) * 1000,
  }), [classCount, perClassFee]);

  const amountCalculation = useMemo(() => ({
    count: directAmount > 0 ? 1 : 0,
    totalCredit: directAmount > 0 ? directAmount : 0,
  }), [directAmount]);

  const currentCalculation = inputMode === 'date'
    ? dateCalculation
    : inputMode === 'count'
      ? countCalculation
      : amountCalculation;
  const finalReason = reason === '기타' ? customReason : reason;
  const classDaysText = classDays.length > 0 ? classDays.map((day) => DAY_NAMES[day]).join(', ') : '미설정';

  const loadCredits = useCallback(async () => {
    try {
      setLoadingCredits(true);
      const response = await studentsAPI.getCredits(studentId);
      setCredits(response.credits || []);
    } catch (err) {
      console.error('크레딧 목록 로드 실패:', err);
    } finally {
      setLoadingCredits(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (open && mainTab === 'manage') {
      void loadCredits();
    }
  }, [open, mainTab, studentId, loadCredits]);

  const resetForm = () => {
    setInputMode('date');
    setStartDate('');
    setEndDate('');
    setClassCount(1);
    setDirectAmount(0);
    setReason('');
    setCustomReason('');
    setNotes('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    setMainTab('create');
    setEditingCredit(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateCreditForm()) return;

    try {
      setProcessing(true);
      setError('');
      const result = await studentsAPI.createManualCredit(studentId, getCreditRequestData());
      toast.success('크레딧 생성 완료', { description: result.message });
      onSuccess();
      resetForm();
      if (mainTab === 'manage') {
        void loadCredits();
      }
    } catch (err) {
      setError(getApiErrorMessage(err, '크레딧 생성 중 오류가 발생했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const validateCreditForm = () => {
    if (!finalReason.trim()) {
      setError('사유를 입력해주세요.');
      return false;
    }

    if (inputMode === 'date' && (!startDate || !endDate)) {
      setError('시작일과 종료일을 입력해주세요.');
      return false;
    }

    if (inputMode === 'date' && dateCalculation.count === 0) {
      setError('해당 기간에 수업일이 없습니다.');
      return false;
    }

    if (inputMode === 'count' && (classCount < 1 || classCount > 12)) {
      setError('회차는 1~12 사이로 입력해주세요.');
      return false;
    }

    if (inputMode === 'amount' && (!directAmount || directAmount < 1000)) {
      setError('금액은 1,000원 이상 입력해주세요.');
      return false;
    }

    if (inputMode === 'amount' && directAmount > 10000000) {
      setError('금액은 10,000,000원 이하로 입력해주세요.');
      return false;
    }

    return true;
  };

  const getCreditRequestData = () => {
    if (inputMode === 'date') {
      return { start_date: startDate, end_date: endDate, reason: finalReason, notes: notes || undefined };
    }

    if (inputMode === 'count') {
      return { class_count: classCount, reason: finalReason, notes: notes || undefined };
    }

    return { direct_amount: directAmount, reason: finalReason, notes: notes || undefined };
  };

  const handleDelete = async (creditId: number) => {
    if (!confirm('이 크레딧을 삭제하시겠습니까?')) return;

    try {
      await studentsAPI.deleteCredit(studentId, creditId);
      toast.success('크레딧이 삭제되었습니다.');
      void loadCredits();
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '크레딧 삭제에 실패했습니다.'));
    }
  };

  const handleEdit = (credit: ManualCredit) => {
    setEditingCredit(credit);
    setEditAmount(credit.credit_amount);
    setEditNotes(credit.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCredit) return;

    try {
      setProcessing(true);
      await studentsAPI.updateCredit(studentId, editingCredit.id, {
        credit_amount: editAmount,
        notes: editNotes,
      });
      toast.success('크레딧이 수정되었습니다.');
      setEditingCredit(null);
      void loadCredits();
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '크레딧 수정에 실패했습니다.'));
    } finally {
      setProcessing(false);
    }
  };

  const openApplyModal = (credit: ManualCredit) => {
    const now = new Date();
    setApplyingCredit(credit);
    setApplyYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleApplyCredit = async () => {
    if (!applyingCredit || !applyYearMonth) return;

    try {
      setApplying(true);
      const result = await studentsAPI.applyCredit(studentId, applyingCredit.id, applyYearMonth);
      toast.success(result.message);
      setApplyingCredit(null);
      void loadCredits();
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '크레딧 적용에 실패했습니다.'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              크레딧 관리
            </DialogTitle>
            <DialogDescription>
              {studentName} 학생의 크레딧을 관리합니다.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as MainTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create" className="flex items-center gap-1">
                <CreditCard className="w-4 h-4" />
                새 크레딧
              </TabsTrigger>
              <TabsTrigger value="manage" className="flex items-center gap-1">
                <List className="w-4 h-4" />
                크레딧 목록
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <ManualCreditCreateForm
                monthlyTuition={monthlyTuition}
                weeklyCount={weeklyCount}
                classDaysText={classDaysText}
                perClassFee={perClassFee}
                inputMode={inputMode}
                startDate={startDate}
                endDate={endDate}
                classCount={classCount}
                directAmount={directAmount}
                reason={reason}
                customReason={customReason}
                notes={notes}
                error={error}
                processing={processing}
                dateCalculation={dateCalculation}
                countCalculation={countCalculation}
                currentCalculation={currentCalculation}
                onInputModeChange={setInputMode}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClassCountChange={setClassCount}
                onDirectAmountChange={setDirectAmount}
                onReasonChange={setReason}
                onCustomReasonChange={setCustomReason}
                onNotesChange={setNotes}
                onSubmit={handleSubmit}
                onCancel={handleClose}
              />
            </TabsContent>

            <TabsContent value="manage">
              <ManualCreditList
                credits={credits}
                loadingCredits={loadingCredits}
                editingCredit={editingCredit}
                editAmount={editAmount}
                editNotes={editNotes}
                processing={processing}
                onEdit={handleEdit}
                onCancelEdit={() => setEditingCredit(null)}
                onEditAmountChange={setEditAmount}
                onEditNotesChange={setEditNotes}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
                onApply={openApplyModal}
                onClose={handleClose}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ManualCreditApplyDialog
        applyingCredit={applyingCredit}
        applyYearMonth={applyYearMonth}
        applying={applying}
        onApplyYearMonthChange={setApplyYearMonth}
        onClose={() => setApplyingCredit(null)}
        onApply={handleApplyCredit}
      />
    </>
  );
}
