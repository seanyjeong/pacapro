import { Banknote } from 'lucide-react';
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
    <section className="rounded-md border border-border bg-card shadow-none" aria-label="지출 내역">
      <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
        <Banknote className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">지출 내역</h2>
      </div>

      <div className="space-y-3 p-3 lg:hidden">
        {expenses.map((expense) => (
          <article
            key={expense.id}
            className="rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-muted/35"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{expense.description || '-'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{expense.expense_date.split('T')[0]}</p>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums text-red-600 dark:text-red-300">
                -{formatAmount(expense.amount)}원
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">카테고리</p>
                <div className="mt-1">
                  <ExpenseCategoryBadge expense={expense} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">지불</p>
                <p className="mt-1 text-foreground">{PAYMENT_METHOD_LABELS[expense.payment_method || 'account']}</p>
              </div>
            </div>

            {expense.notes ? (
              <p className="mt-4 rounded-md bg-muted/35 px-3 py-2 text-xs text-muted-foreground">{expense.notes}</p>
            ) : null}

            <div className="mt-4 border-t border-border/70 pt-3">
              <ExpenseRowActions
                expense={expense}
                canEdit={canEdit}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onCompleteRefund={onCompleteRefund}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">날짜</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">카테고리</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">설명</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">금액</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">지불</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expenses.map((expense) => (
              <tr
                key={expense.id}
                className="transition-colors hover:bg-muted/35"
              >
                <td className="px-5 py-3 text-muted-foreground">{expense.expense_date.split('T')[0]}</td>
                <td className="px-5 py-3">
                  <ExpenseCategoryBadge expense={expense} />
                </td>
                <td className="max-w-[280px] truncate px-5 py-3 text-foreground">{expense.description || '-'}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-red-600 dark:text-red-300">
                  -{formatAmount(expense.amount)}원
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[expense.payment_method || 'account']}
                </td>
                <td className="px-5 py-3">
                  <ExpenseRowActions
                    expense={expense}
                    canEdit={canEdit}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCompleteRefund={onCompleteRefund}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
