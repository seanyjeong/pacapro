import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
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
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="text-base font-semibold tracking-normal">
          {editingId ? '지출 수정' : '지출 등록'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-5">
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
            <label htmlFor="expense-amount" className="block text-sm font-medium text-foreground">금액</label>
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
            <label htmlFor="expense-notes" className="block text-sm font-medium text-foreground">메모</label>
            <textarea
              id="expense-notes"
              value={formData.notes}
              onChange={(event) => onUpdate('notes', event.target.value)}
              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
            />
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '저장 중' : editingId ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
