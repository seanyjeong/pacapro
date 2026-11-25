'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import type { Payment, PaymentFormData } from '@/lib/types/payment';
import { PAYMENT_TYPE_OPTIONS } from '@/lib/types/payment';
import { PaymentFormSummary } from './payment-form-summary';
import type { PaymentFormMode, PaymentFormStudent, PaymentFormSubmit } from './payment-editor-types';
import { buildDefaultPaymentFormData, getFinalPaymentAmount, getStudentTuitionValues } from './payment-editor-utils';

interface PaymentFormProps {
  mode: PaymentFormMode;
  initialData?: PaymentFormData;
  editingPayment?: Payment;
  students: PaymentFormStudent[];
  onSubmit: PaymentFormSubmit;
  onCancel: () => void;
  loading?: boolean;
}

export function PaymentForm({ mode, initialData, editingPayment, students, onSubmit, onCancel, loading }: PaymentFormProps) {
  const [formData, setFormData] = useState<PaymentFormData>(initialData || buildDefaultPaymentFormData());
  const [confirmZero, setConfirmZero] = useState(false);
  const editing = mode === 'edit' && editingPayment && initialData ? { payment: editingPayment, initial: initialData } : undefined;
  const finalAmount = getFinalPaymentAmount(formData, editing);
  // 휴원·퇴원 정산 등으로 최종 금액을 따로 정한 청구: 기본·할인 금액은 잠그고 추가 금액·청구액 직접 입력으로 조정(서버도 막는다)
  const amountLocked = Boolean(editing?.payment.separately_priced);
  // 일할·할인이 있는 시즌 청구는 깎은 금액이 추가 금액 칸에 있어 그 칸도 잠근다
  const additionalLocked = amountLocked && editing?.payment.payment_type === 'season';

  const setField = <K extends keyof PaymentFormData>(key: K, value: PaymentFormData[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  // 금액 칸을 바꾸면 직접 정한 청구액은 지우고 다시 계산한다
  const setAmount = (key: 'base_amount' | 'discount_amount' | 'additional_amount', value: number) => {
    setFormData((previous) => ({ ...previous, [key]: value, final_amount: undefined }));
  };

  const changeStudent = (studentId: number) => {
    const student = students.find((item) => item.id === studentId);
    const tuition = formData.payment_type === 'monthly' ? getStudentTuitionValues(student) : {};
    setFormData((previous) => ({ ...previous, student_id: studentId, ...tuition }));
  };

  const changePaymentType = (paymentType: PaymentFormData['payment_type']) => {
    const student = students.find((item) => item.id === formData.student_id);
    const tuition = paymentType === 'monthly' && !amountLocked ? getStudentTuitionValues(student) : {};
    setFormData((previous) => ({ ...previous, payment_type: paymentType, ...tuition, ...('base_amount' in tuition ? { final_amount: undefined } : {}) }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.student_id === 0) {
      toast.error('학생을 선택해주세요.');
      return;
    }
    // 청구액 칸을 비우면 0원이 된다 — 실수로 0원 청구가 되지 않게 한 번 묻는다
    if (editing && formData.final_amount === 0 && Number(editing.payment.final_amount) > 0) {
      setConfirmZero(true);
      return;
    }
    await onSubmit(formData);
  };

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0 lg:sticky lg:top-20 lg:order-2">
        <PaymentFormSummary finalAmount={finalAmount} formData={formData} students={students} paymentContext={editingPayment} amountLocked={amountLocked} />
      </div>

      <div className="min-w-0 space-y-4 lg:order-1">
        <section className="rounded-2xl bg-card">
          <SectionHeader title="청구 대상" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
            <Field label="학생">
              <select value={formData.student_id} onChange={(event) => changeStudent(Number(event.target.value))} disabled={mode === 'edit'} className={controlClassName} required>
                <option value={0}>학생 선택</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.name} ({student.student_number})</option>
                ))}
              </select>
            </Field>
            <Field label="청구 유형">
              <select value={formData.payment_type} onChange={(event) => changePaymentType(event.target.value as PaymentFormData['payment_type'])} className={controlClassName} required>
                {PAYMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-card">
          <SectionHeader title="청구 조건" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
            <Field label="청구 월">
              <input type="month" value={formData.year_month} onChange={(event) => setField('year_month', event.target.value)} className={controlClassName} required />
            </Field>
            <Field label="납부 기한">
              <input type="date" value={formData.due_date} onChange={(event) => setField('due_date', event.target.value)} className={controlClassName} required />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-card">
          <SectionHeader title="금액" />
          {amountLocked ? (
            <p className="mx-5 mb-3 break-keep rounded-xl bg-warning/10 px-4 py-3 text-[13px] leading-relaxed text-foreground sm:mx-6" data-testid="payment-amount-locked">
              {additionalLocked
                ? '금액이 따로 정해진 시즌 청구예요(일할·할인 등). 금액을 바꾸려면 청구액을 직접 입력하세요.'
                : '휴원·퇴원 정산 등으로 금액이 따로 정해진 청구예요. 기본·할인 금액은 바꿀 수 없어요. 추가 금액을 쓰면 바꾼 만큼 더하거나 빠지고, 청구액을 직접 입력할 수도 있어요.'}
            </p>
          ) : null}
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3 sm:px-6">
            <MoneyField label="기본 금액" value={formData.base_amount} onChange={(value) => setAmount('base_amount', value)} required disabled={amountLocked} />
            <MoneyField label="할인 금액" value={formData.discount_amount} onChange={(value) => setAmount('discount_amount', value)} disabled={amountLocked} />
            <MoneyField label="추가 금액" value={formData.additional_amount} onChange={(value) => setAmount('additional_amount', value)} disabled={additionalLocked} />
          </div>
          {editing ? (
            <div className="grid gap-1 border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
              <MoneyField label="청구액 직접 입력" value={finalAmount} onChange={(value) => setField('final_amount', value)} />
              <p className="break-keep text-[13px] text-muted-foreground">
                여기에 적은 금액이 그대로 청구액이 돼요. 이미 받은 돈보다 낮출 수는 없어요.
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl bg-card">
          <SectionHeader title="메모" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
            <Field label="설명">
              <input type="text" value={formData.description} onChange={(event) => setField('description', event.target.value)} className={controlClassName} />
            </Field>
            <Field label="내부 메모">
              <textarea value={formData.notes} onChange={(event) => setField('notes', event.target.value)} className={controlClassName} rows={3} />
            </Field>
          </div>
        </section>

        <div className="flex gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="flex-1 sm:flex-none">취소</Button>
          <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">{loading ? '저장 중' : mode === 'edit' ? '수정' : '등록'}</Button>
        </div>
      </div>

      <AlertDialog open={confirmZero} onOpenChange={setConfirmZero}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>0원 청구로 저장할까요?</AlertDialogTitle>
            <AlertDialogDescription>청구액이 0원이 됩니다. 칸을 비운 것이라면 취소하고 금액을 다시 적어 주세요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onSubmit(formData)}>0원으로 저장</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

const controlClassName = 'min-h-11 w-full rounded-xl border border-transparent bg-muted px-3 py-2.5 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-60';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 pb-3 pt-5 sm:px-6">
      <h2 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground">{label}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange, required = false, disabled = false }: { label: string; value?: number; onChange: (value: number) => void; required?: boolean; disabled?: boolean }) {
  return (
    <Field label={label}>
      <MoneyInput value={value} onChange={onChange} required={required} disabled={disabled} className="text-[15px] font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-60" />
    </Field>
  );
}
