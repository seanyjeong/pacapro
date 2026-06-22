import { Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PAYMENT_METHOD_LABELS } from './expenses-constants';
import { ExpenseCategoryBadge } from './expense-category-badge';
import { ExpenseRowActions } from './expense-row-actions';
import type { Expense } from './expenses-types';
import { formatAmount } from './expenses-utils';

interface ExpensesTableProps {
  expenses: Expense[];
  canEdit: boolean;
  onSelect: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
  onCompleteRefund: (id: number, paymentMethod?: string) => void;
}

export function ExpensesTable({ expenses, canEdit, onSelect, onEdit, onDelete, onCompleteRefund }: ExpensesTableProps) {
  return (
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-normal">
          <Banknote className="h-4 w-4" />
          지출 내역
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">날짜</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">카테고리</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">설명</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">금액</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">지불</th>
                {canEdit ? <th className="px-5 py-3 text-right font-medium text-muted-foreground">관리</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="cursor-pointer hover:bg-muted/35"
                  onClick={() => onSelect(expense)}
                >
                  <td className="px-5 py-3 text-muted-foreground">{expense.expense_date.split('T')[0]}</td>
                  <td className="px-5 py-3">
                    <ExpenseCategoryBadge expense={expense} />
                  </td>
                  <td className="max-w-[280px] truncate px-5 py-3 text-foreground">{expense.description || '-'}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-red-600">
                    -{formatAmount(expense.amount)}원
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[expense.payment_method || 'account']}
                  </td>
                  {canEdit ? (
                    <td className="px-5 py-3">
                      <ExpenseRowActions
                        expense={expense}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onCompleteRefund={onCompleteRefund}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
