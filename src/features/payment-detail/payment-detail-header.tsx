import { ArrowLeft, CreditCard, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Payment } from '@/lib/types/payment';

interface PaymentDetailHeaderProps {
  payment: Payment;
  canEdit: boolean;
  canDelete: boolean;
  deleting: boolean;
  onBack: () => void;
  onRecordPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PaymentDetailHeader({ payment, canEdit, canDelete, deleting, onBack, onRecordPayment, onEdit, onDelete }: PaymentDetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">학원비 상세</h1>
          <p className="mt-1 text-sm text-muted-foreground">{payment.year_month}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && payment.payment_status !== 'paid' ? (
          <Button type="button" onClick={onRecordPayment}>
            <CreditCard className="mr-2 h-4 w-4" />
            납부 기록
          </Button>
        ) : null}
        {canEdit ? (
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            수정
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" variant="outline" onClick={onDelete} disabled={deleting} className="text-rose-700 hover:text-rose-800">
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? '삭제 중' : '삭제'}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
