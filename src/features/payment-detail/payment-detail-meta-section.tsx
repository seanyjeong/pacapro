import { Check, Pencil, X } from 'lucide-react';
import { SectionCard } from '@/components/ui/page';
import { useEffect, useState } from 'react';
import type { Payment } from '@/lib/types/payment';
import { PAYMENT_METHOD_LABELS } from '@/lib/types/payment';
import { formatDate } from '@/lib/utils/payment-helpers';

interface PaymentDetailMetaSectionProps {
  payment: Payment;
  canEditPaidDate: boolean;
  onUpdatePaidDate: (paidDate: string) => Promise<void>;
}

export function PaymentDetailMetaSection({ payment, canEditPaidDate, onUpdatePaidDate }: PaymentDetailMetaSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [paidDate, setPaidDate] = useState(payment.paid_date?.split('T')[0] || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPaidDate(payment.paid_date?.split('T')[0] || '');
  }, [payment.paid_date]);

  const savePaidDate = async () => {
    if (!paidDate) return;
    setSaving(true);
    try {
      await onUpdatePaidDate(paidDate);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setPaidDate(payment.paid_date?.split('T')[0] || '');
    setIsEditing(false);
  };

  return (
    <SectionCard title="납부 정보">
      <div className="divide-y divide-border/60 text-[15px]">
        <Meta label="납부 기한" value={formatDate(payment.due_date)} />
        <div className="flex min-h-[48px] items-center justify-between gap-3 py-2">
          <p className="text-muted-foreground">납부일</p>
          {isEditing ? (
            <div className="flex min-w-0 items-center gap-1">
              <input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} disabled={saving} className="h-10 min-w-0 rounded-xl border border-transparent bg-muted px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:bg-card" />
              <button type="button" onClick={savePaidDate} disabled={saving} className="rounded-lg p-2 text-success hover:bg-success-soft" aria-label="납부일 저장" title="납부일 저장">
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={cancelEdit} disabled={saving} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="납부일 수정 취소" title="납부일 수정 취소">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="font-semibold tabular-nums text-foreground">{payment.paid_date ? formatDate(payment.paid_date) : '-'}</p>
              {canEditPaidDate && payment.paid_date ? (
                <button type="button" onClick={() => setIsEditing(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="납부일 수정" title="납부일 수정">
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
        </div>
        <Meta label="납부 방법" value={payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method] : '-'} />
      </div>
    </SectionCard>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
