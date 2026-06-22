import { CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PAYMENT_METHOD_LABELS } from './expenses-constants';
import { ExpenseCategoryBadge } from './expense-category-badge';
import { ExpenseDetailItem } from './expense-detail-item';
import type { Expense } from './expenses-types';
import { formatAmount, isEditableExpense, isRefundPendingExpense } from './expenses-utils';

interface ExpenseDetailDialogProps {
  expense: Expense | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
  onCompleteRefund: (id: number, paymentMethod?: string) => void;
}

export function ExpenseDetailDialog({
  expense,
  canEdit,
  onClose,
  onEdit,
  onDelete,
  onCompleteRefund,
}: ExpenseDetailDialogProps) {
  return (
    <Dialog open={Boolean(expense)} onOpenChange={(open) => !open && onClose()}>
      {expense ? (
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>지출 상세</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <ExpenseDetailItem label="지출일" value={expense.expense_date.split('T')[0]} />
            <div>
              <p className="text-sm text-muted-foreground">카테고리</p>
              <div className="mt-1">
                <ExpenseCategoryBadge expense={expense} />
              </div>
            </div>
            <ExpenseDetailItem label="금액" value={`-${formatAmount(expense.amount)}원`} />
            <ExpenseDetailItem label="지불 방법" value={PAYMENT_METHOD_LABELS[expense.payment_method || 'account']} />
            {expense.description ? <ExpenseDetailItem label="설명" value={expense.description} wide /> : null}
            {expense.notes ? <ExpenseDetailItem label="메모" value={expense.notes} wide /> : null}
          </div>
          <DialogFooter>
            {canEdit && isRefundPendingExpense(expense) ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onCompleteRefund(expense.id);
                }}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                환불 완료
              </Button>
            ) : null}
            {canEdit && isEditableExpense(expense) ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onEdit(expense);
                    onClose();
                  }}
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  수정
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onDelete(expense.id);
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  삭제
                </Button>
              </>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
