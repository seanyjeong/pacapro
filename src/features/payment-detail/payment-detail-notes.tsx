import { SectionCard } from '@/components/ui/page';
import type { Payment } from '@/lib/types/payment';

export function PaymentDetailNotes({ payment }: { payment: Payment }) {
  if (!payment.description && !payment.notes) return null;

  return (
    <SectionCard title="메모">
      <div className="grid gap-4 text-[15px] sm:grid-cols-2">
        {payment.description ? <TextBlock label="설명" value={payment.description} /> : null}
        {payment.notes ? <TextBlock label="내부 메모" value={payment.notes} /> : null}
      </div>
    </SectionCard>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{value}</p>
    </div>
  );
}
