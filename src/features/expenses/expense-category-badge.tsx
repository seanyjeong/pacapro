import { Badge } from '@/components/ui/badge';
import { EXPENSE_CATEGORY_LABELS } from './expenses-constants';
import type { Expense } from './expenses-types';
import { isRefundPendingExpense } from './expenses-utils';

interface ExpenseCategoryBadgeProps {
  expense: Expense;
}

export function ExpenseCategoryBadge({ expense }: ExpenseCategoryBadgeProps) {
  const isPending = isRefundPendingExpense(expense);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge variant={isPending ? 'warning' : 'secondary'}>
        {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
      </Badge>
      {expense.category === 'salary' && expense.instructor_name ? (
        <span className="truncate text-sm font-medium text-foreground">({expense.instructor_name})</span>
      ) : null}
    </div>
  );
}
