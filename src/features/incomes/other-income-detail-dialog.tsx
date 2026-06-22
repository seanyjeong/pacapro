import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IncomeDetailItem } from './income-detail-item';
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from './incomes-constants';
import type { OtherIncome } from './incomes-types';
import { formatAmount } from './incomes-utils';

interface OtherIncomeDetailDialogProps {
  income: OtherIncome | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (income: OtherIncome) => void;
  onDelete: (id: number) => void;
}

export function OtherIncomeDetailDialog({ income, canEdit, onClose, onEdit, onDelete }: OtherIncomeDetailDialogProps) {
  return (
    <Dialog open={Boolean(income)} onOpenChange={(open) => !open && onClose()}>
      {income ? (
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>기타수입 상세</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <IncomeDetailItem label="날짜" value={income.income_date.split('T')[0]} />
            <IncomeDetailItem label="카테고리" value={CATEGORY_LABELS[income.category] || income.category} />
            <IncomeDetailItem label="금액" value={`+${formatAmount(income.amount)}원`} />
            <IncomeDetailItem label="결제방법" value={PAYMENT_METHOD_LABELS[income.payment_method || 'cash']} />
            {income.description ? <IncomeDetailItem label="설명" value={income.description} wide /> : null}
            {income.notes ? <IncomeDetailItem label="메모" value={income.notes} wide /> : null}
          </div>
          {canEdit ? (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(income);
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
                  onDelete(income.id);
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                삭제
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
