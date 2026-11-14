import Link from 'next/link';
import { CheckCircle, Eye, FileText, Pencil, Trash2, UserRound } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
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

const actionClassName = buttonVariants({ variant: 'outline', size: 'sm' });

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
    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`${description} 지출 상세 보기`}
        onClick={() => onSelect(expense)}
        className={actionClassName}
      >
        <Eye className="h-4 w-4" />
        상세
      </button>

      {expense.salary_id ? (
        <Link
          aria-label={`${description} 급여 명세서 보기`}
          className={actionClassName}
          href={`/salaries/${expense.salary_id}`}
        >
          <FileText className="h-4 w-4" />
          명세서
        </Link>
      ) : null}

      {expense.instructor_id ? (
        <Link
          aria-label={`${expense.instructor_name || description} 강사 상세 보기`}
          className={actionClassName}
          href={`/instructors/${expense.instructor_id}`}
        >
          <UserRound className="h-4 w-4" />
          강사
        </Link>
      ) : null}

      {canEdit && isRefundPending ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onCompleteRefund(expense.id)}
          className="bg-success-soft text-success hover:bg-success-soft/70 hover:text-success"
        >
          <CheckCircle className="h-4 w-4" />
          환불 완료
        </Button>
      ) : null}

      {canEdit && isEditable ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="지출 수정"
            onClick={() => onEdit(expense)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="지출 삭제"
            onClick={() => onDelete(expense.id)}
            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      ) : null}
    </div>
  );
}
