'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import type { PaymentFormData } from '@/lib/types/payment';
import { PAYMENT_TYPE_OPTIONS } from '@/lib/types/payment';
import type { PaymentFormMode, PaymentFormStudent, PaymentFormSubmit } from './payment-editor-types';
import { buildDefaultPaymentFormData, getFinalPaymentAmount, getStudentTuitionValues } from './payment-editor-utils';

interface PaymentFormProps {
  mode: PaymentFormMode;
  initialData?: PaymentFormData;
  students: PaymentFormStudent[];
  onSubmit: PaymentFormSubmit;
  onCancel: () => void;
  loading?: boolean;
}

export function PaymentForm({ mode, initialData, students, onSubmit, onCancel, loading }: PaymentFormProps) {
  const [formData, setFormData] = useState<PaymentFormData>(initialData || buildDefaultPaymentFormData());
  const finalAmount = getFinalPaymentAmount(formData);

  const setField = <K extends keyof PaymentFormData>(key: K, value: PaymentFormData[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const changeStudent = (studentId: number) => {
    const student = students.find((item) => item.id === studentId);
    const tuition = formData.payment_type === 'monthly' ? getStudentTuitionValues(student) : {};
    setFormData((previous) => ({ ...previous, student_id: studentId, ...tuition }));
  };

  const changePaymentType = (paymentType: PaymentFormData['payment_type']) => {
    const student = students.find((item) => item.id === formData.student_id);
    const tuition = paymentType === 'monthly' ? getStudentTuitionValues(student) : {};
    setFormData((previous) => ({ ...previous, payment_type: paymentType, ...tuition }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (formData.student_id === 0) {
      toast.error('학생을 선택해주세요.');
      return;
    }
    await onSubmit(formData);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="rounded-lg border border-border/70 bg-card">
        <SectionHeader title="청구 대상" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
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

      <section className="rounded-lg border border-border/70 bg-card">
        <SectionHeader title="청구 조건" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="청구 월">
            <input type="month" value={formData.year_month} onChange={(event) => setField('year_month', event.target.value)} className={controlClassName} required />
          </Field>
          <Field label="납부 기한">
            <input type="date" value={formData.due_date} onChange={(event) => setField('due_date', event.target.value)} className={controlClassName} required />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card">
        <SectionHeader title="금액" />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <MoneyField label="기본 금액" value={formData.base_amount} onChange={(value) => setField('base_amount', value)} required />
          <MoneyField label="할인 금액" value={formData.discount_amount} onChange={(value) => setField('discount_amount', value)} />
          <MoneyField label="추가 금액" value={formData.additional_amount} onChange={(value) => setField('additional_amount', value)} />
        </div>
        <div className="border-t border-border/70 p-4">
          <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-3">
            <span className="text-sm font-semibold text-blue-900">최종 청구 금액</span>
            <span className="text-xl font-bold text-blue-800">{finalAmount.toLocaleString()}원</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card">
        <SectionHeader title="메모" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="설명">
            <input type="text" value={formData.description} onChange={(event) => setField('description', event.target.value)} className={controlClassName} />
          </Field>
          <Field label="내부 메모">
            <textarea value={formData.notes} onChange={(event) => setField('notes', event.target.value)} className={controlClassName} rows={3} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>취소</Button>
        <Button type="submit" disabled={loading}>{loading ? '저장 중' : mode === 'edit' ? '수정' : '등록'}</Button>
      </div>
    </form>
  );
}

const controlClassName = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border/70 p-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange, required = false }: { label: string; value?: number; onChange: (value: number) => void; required?: boolean }) {
  return (
    <Field label={label}>
      <MoneyInput value={value} onChange={onChange} required={required} className="py-2 text-sm focus:ring-2 focus:ring-primary/20" />
    </Field>
  );
}
