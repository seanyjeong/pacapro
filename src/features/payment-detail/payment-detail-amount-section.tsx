import { SectionCard } from '@/components/ui/page';
import type { Payment } from '@/lib/types/payment';
import { getAmountLabel } from './payment-detail-utils';

/** 총 청구가 어떻게 나왔는지(기본·할인·추가). 총 청구·납부·남은 금액은 위 요약 카드에 있다. */
export function PaymentDetailAmountSection({ payment }: { payment: Payment }) {
  return (
    <SectionCard title="청구 계산">
      <div className="divide-y divide-border/60 text-[15px]">
        <Line label="기본 금액" value={getAmountLabel(payment.base_amount)} />
        {payment.discount_amount > 0 ? <Line label="할인 금액" value={`-${getAmountLabel(payment.discount_amount)}`} danger /> : null}
        {payment.additional_amount > 0 ? <Line label={payment.notes?.includes('비시즌 종강 일할') ? '비시즌 종강 일할' : '추가 금액'} value={`+${getAmountLabel(payment.additional_amount)}`} info /> : null}
      </div>
    </SectionCard>
  );
}

function Line({ label, value, danger = false, info = false }: { label: string; value: string; danger?: boolean; info?: boolean }) {
  const color = danger ? 'text-destructive' : info ? 'text-primary' : 'text-foreground';
  return (
    <div className="flex justify-between gap-3 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
