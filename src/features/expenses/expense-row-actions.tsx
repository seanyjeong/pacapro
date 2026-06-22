import Link from 'next/link';
import { CheckCircle, Eye, FileText, Pencil, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Expense } from './expenses-types';
import { isEditableExpense, isRefundPendingExpense } from './expenses-utils';

interface ExpenseRowActionsProps {
  expense: Expense;
  canEdit: boolean;
  onSelect: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
  onCompleteRefund: (id: number, paymentMethod?: string) => void;
}

const actionClassName =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

export function ExpenseRowActions({
  expense,
  canEdit,
  onSelect,
  onEdit,
  onDelete,
  onCompleteRefund,
}: ExpenseRowActionsProps) {
  const description = expense.description || '선택한 지출';
  const isRefundPending = isRefundPendingExpense(expense);
  const isEditable = isEditableExpense(expense);

  return (
    <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`${description} 지출 상세 보기`}
        onClick={() => onSelect(expense)}
        className={actionClassName}
      >
        <Eye className="h-3.5 w-3.5" />
        상세
      </button>

      {expense.salary_id ? (
        <Link
          aria-label={`${description} 급여 명세서 보기`}
          className={actionClassName}
          href={`/salaries/${expense.salary_id}`}
        >
          <FileText className="h-3.5 w-3.5" />
          명세서
        </Link>
      ) : null}

      {expense.instructor_id ? (
        <Link
          aria-label={`${expense.instructor_name || description} 강사 상세 보기`}
          className={actionClassName}
          href={`/instructors/${expense.instructor_id}`}
        >
          <UserRound className="h-3.5 w-3.5" />
          강사
        </Link>
      ) : null}

      {canEdit && isRefundPending ? (
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
      ) : null}

      {canEdit && isEditable ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}
