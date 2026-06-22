import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { IncomeInput } from './income-input';
import { IncomeSelect } from './income-select';
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from './incomes-constants';
import type { IncomeFormData } from './incomes-types';

interface OtherIncomeFormProps {
  formData: IncomeFormData;
  editingId: number | null;
  saving: boolean;
  onUpdate: <K extends keyof IncomeFormData>(key: K, value: IncomeFormData[K]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function OtherIncomeForm({ formData, editingId, saving, onUpdate, onSubmit, onCancel }: OtherIncomeFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="text-base font-semibold tracking-normal">
          {editingId ? '기타수입 수정' : '기타수입 등록'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <IncomeInput
            id="income-date"
            label="날짜"
            type="date"
            value={formData.income_date}
            onChange={(value) => onUpdate('income_date', value)}
            required
          />
          <IncomeSelect
            id="income-category"
            label="카테고리"
            value={formData.category}
            options={CATEGORY_OPTIONS}
            onChange={(value) => onUpdate('category', value)}
          />
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="income-amount" className="block text-sm font-medium text-foreground">
              금액
            </label>
            <MoneyInput
              id="income-amount"
              value={formData.amount}
              onChange={(amount) => onUpdate('amount', amount)}
              required
            />
          </div>
          <IncomeInput
            id="income-description"
            label="설명"
            value={formData.description}
            onChange={(value) => onUpdate('description', value)}
            placeholder="예: 운동복 판매, 음료 판매"
          />
          <IncomeSelect
            id="income-payment-method"
            label="결제 방법"
            value={formData.payment_method}
            options={PAYMENT_METHOD_OPTIONS}
            onChange={(value) => onUpdate('payment_method', value)}
          />
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="income-notes" className="block text-sm font-medium text-foreground">
              메모
            </label>
            <textarea
              id="income-notes"
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
