import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { SectionCard } from '@/components/ui/page';
import { Textarea } from '@/components/ui/textarea';
import { EXPENSE_CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from './expenses-constants';
import type { ExpenseFormData } from './expenses-types';
import { ExpenseInput } from './expense-input';
import { ExpenseSelect } from './expense-select';

interface ExpenseFormProps {
  formData: ExpenseFormData;
  editingId: number | null;
  saving: boolean;
  onUpdate: <K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ formData, editingId, saving, onUpdate, onSubmit, onCancel }: ExpenseFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    onSubmit();
  };

  return (
    <SectionCard title={editingId ? '지출 수정' : '지출 등록'}>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <ExpenseInput
          id="expense-date"
          label="지출일"
          type="date"
          value={formData.expense_date}
          onChange={(value) => onUpdate('expense_date', value)}
          required
        />
        <ExpenseSelect
          id="expense-category"
          label="카테고리"
          value={formData.category}
          options={EXPENSE_CATEGORY_OPTIONS}
          onChange={(value) => onUpdate('category', value)}
        />
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="expense-amount" className="block text-sm font-semibold text-secondary-foreground">금액</label>
          <MoneyInput
            id="expense-amount"
            value={formData.amount}
            onChange={(amount) => onUpdate('amount', amount)}
            required
          />
        </div>
        <ExpenseInput
          id="expense-description"
          label="설명"
          value={formData.description}
          onChange={(value) => onUpdate('description', value)}
          placeholder="예: 월세, 소모품 구입, 환불"
        />
        <ExpenseSelect
          id="expense-payment-method"
          label="지불 방법"
          value={formData.payment_method}
          options={PAYMENT_METHOD_OPTIONS}
          onChange={(value) => onUpdate('payment_method', value)}
        />
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="expense-notes" className="block text-sm font-semibold text-secondary-foreground">메모</label>
          <Textarea
            id="expense-notes"
            value={formData.notes}
            onChange={(event) => onUpdate('notes', event.target.value)}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="w-full sm:w-auto">
            취소
          </Button>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? '저장 중' : editingId ? '수정' : '등록'}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
