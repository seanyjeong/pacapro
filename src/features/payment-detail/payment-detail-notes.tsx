import type { Payment } from '@/lib/types/payment';

export function PaymentDetailNotes({ payment }: { payment: Payment }) {
  if (!payment.description && !payment.notes) return null;

  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/70 p-3">
        <h2 className="text-sm font-semibold text-foreground">메모</h2>
      </div>
      <div className="grid gap-4 p-4 text-sm sm:grid-cols-2">
        {payment.description ? <TextBlock label="설명" value={payment.description} /> : null}
        {payment.notes ? <TextBlock label="내부 메모" value={payment.notes} /> : null}
      </div>
    </section>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{value}</p>
    </div>
  );
}
