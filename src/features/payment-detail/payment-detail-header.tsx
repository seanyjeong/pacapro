import { ArrowLeft, CreditCard, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import type { Payment } from '@/lib/types/payment';

interface PaymentDetailHeaderProps {
  payment: Payment;
  canEdit: boolean;
  canDelete: boolean;
  canCancel: boolean;
  deleting: boolean;
  canceling: boolean;
  onBack: () => void;
  onRecordPayment: () => void;
  onCancelPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PaymentDetailHeader({
  payment,
  canEdit,
  canDelete,
  canCancel,
  deleting,
  canceling,
  onBack,
  onRecordPayment,
  onCancelPayment,
  onEdit,
  onDelete,
}: PaymentDetailHeaderProps) {
  return (
    <div className="flex items-start gap-1">
      <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="뒤로 가기" className="-ml-2 mt-2 shrink-0">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <PageHeader
        className="min-w-0 flex-1"
        title="학원비 상세"
        description={payment.year_month}
        actions={(
          <>
            {canEdit && payment.payment_status !== 'paid' ? (
              <Button type="button" onClick={onRecordPayment}>
                <CreditCard className="h-4 w-4" />
                납부하기
              </Button>
            ) : null}
            {canCancel ? (
              <Button type="button" variant="outline" onClick={onCancelPayment} disabled={canceling}>
                <RotateCcw className="h-4 w-4" />
                {canceling ? '취소 처리 중' : '결제 취소'}
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="outline" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                수정
              </Button>
            ) : null}
            {canDelete ? (
              <Button type="button" variant="ghost" onClick={onDelete} disabled={deleting} className="text-destructive hover:bg-destructive-soft hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                {deleting ? '삭제 중' : '삭제'}
              </Button>
            ) : null}
          </>
        )}
      />
    </div>
  );
}
