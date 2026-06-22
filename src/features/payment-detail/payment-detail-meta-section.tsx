import { Check, Pencil, X } from 'lucide-react';
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
    <section className="rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/70 p-3">
        <h2 className="text-sm font-semibold text-foreground">납부 정보</h2>
      </div>
      <div className="grid gap-0 sm:grid-cols-3">
        <Meta label="납부 기한" value={formatDate(payment.due_date)} />
        <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
          <p className="text-xs text-muted-foreground">납부일</p>
          {isEditing ? (
            <div className="mt-2 flex items-center gap-2">
              <input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} disabled={saving} className="min-w-0 rounded-md border border-border bg-background px-2 py-1 text-sm" />
              <button type="button" onClick={savePaidDate} disabled={saving} className="rounded p-1 text-emerald-700 hover:bg-emerald-50" aria-label="납부일 저장" title="납부일 저장">
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={cancelEdit} disabled={saving} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="납부일 수정 취소" title="납부일 수정 취소">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{payment.paid_date ? formatDate(payment.paid_date) : '-'}</p>
              {canEditPaidDate && payment.paid_date ? (
                <button type="button" onClick={() => setIsEditing(true)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="납부일 수정" title="납부일 수정">
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
        </div>
        <Meta label="납부 방법" value={payment.payment_method ? PAYMENT_METHOD_LABELS[payment.payment_method] : '-'} />
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
