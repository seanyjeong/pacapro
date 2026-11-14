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
    <section aria-label="지출 내역">
      <div className="divide-y divide-border/60 lg:hidden">
        {expenses.map((expense) => (
          <article key={expense.id} className="px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-foreground">{expense.description || '-'}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">{expense.expense_date.split('T')[0]}</p>
              </div>
              <p className="shrink-0 text-base font-bold tabular-nums text-destructive">
                -{formatAmount(expense.amount)}원
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <ExpenseCategoryBadge expense={expense} />
              <span>{PAYMENT_METHOD_LABELS[expense.payment_method || 'account']}</span>
            </div>

            {expense.notes ? (
              <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-[13px] text-secondary-foreground">{expense.notes}</p>
            ) : null}

            <div className="mt-3">
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

      <div className="hidden overflow-x-auto px-6 pb-2 lg:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-[13px] font-semibold text-muted-foreground">
              <th className="px-3 py-3 text-left">날짜</th>
              <th className="px-3 py-3 text-left">카테고리</th>
              <th className="px-3 py-3 text-left">설명</th>
              <th className="px-3 py-3 text-right">금액</th>
              <th className="px-3 py-3 text-left">지불</th>
              <th className="px-3 py-3 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/50">
                <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-secondary-foreground">{expense.expense_date.split('T')[0]}</td>
                <td className="px-3 py-3.5">
                  <ExpenseCategoryBadge expense={expense} />
                </td>
                <td className="max-w-[280px] truncate px-3 py-3.5 font-medium text-foreground">{expense.description || '-'}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right text-[15px] font-bold tabular-nums text-destructive">
                  -{formatAmount(expense.amount)}원
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-secondary-foreground">
                  {PAYMENT_METHOD_LABELS[expense.payment_method || 'account']}
                </td>
                <td className="px-3 py-3.5">
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
