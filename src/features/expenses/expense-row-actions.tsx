import { CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Expense } from './expenses-types';
import { isEditableExpense, isRefundPendingExpense } from './expenses-utils';

interface ExpenseRowActionsProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
  onCompleteRefund: (id: number, paymentMethod?: string) => void;
}

export function ExpenseRowActions({ expense, onEdit, onDelete, onCompleteRefund }: ExpenseRowActionsProps) {
  if (isRefundPendingExpense(expense)) {
    return (
      <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onCompleteRefund(expense.id)}
          className="border-green-600 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/35"
        >
          <CheckCircle className="mr-1.5 h-4 w-4" />
          환불 완료
        </Button>
      </div>
    );
  }

  if (!isEditableExpense(expense)) {
    return <div className="text-right text-xs text-muted-foreground">급여 연동</div>;
  }

  return (
    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label="지출 수정"
        onClick={() => onEdit(expense)}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="지출 삭제"
        onClick={() => onDelete(expense.id)}
        className="rounded-md p-2 text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:text-red-300 dark:hover:bg-red-950/35"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
