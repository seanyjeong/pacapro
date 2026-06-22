import type { Payment } from '@/lib/types/payment';
import { getAmountLabel, getOutstandingAmount } from './payment-detail-utils';

export function PaymentDetailAmountSection({ payment }: { payment: Payment }) {
  const outstanding = getOutstandingAmount(payment);

  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/70 bg-blue-50 p-3">
        <h2 className="text-sm font-semibold text-blue-900">금액 정보</h2>
      </div>
      <div className="p-4 text-sm">
        <Line label="기본 금액" value={getAmountLabel(payment.base_amount)} />
        {payment.discount_amount > 0 ? <Line label="할인 금액" value={`-${getAmountLabel(payment.discount_amount)}`} danger /> : null}
        {payment.additional_amount > 0 ? <Line label={payment.notes?.includes('비시즌 종강 일할') ? '비시즌 종강 일할' : '추가 금액'} value={`+${getAmountLabel(payment.additional_amount)}`} info /> : null}
        <Line label="최종 청구 금액" value={getAmountLabel(payment.final_amount)} strong />
        <Line label="납부 금액" value={getAmountLabel(payment.paid_amount)} success />
        <div className="mt-3 flex justify-between rounded-md bg-muted/40 px-3 py-3">
          <span className="font-semibold text-foreground">미납 잔액</span>
          <span className={outstanding > 0 ? 'text-xl font-bold text-rose-700' : 'text-xl font-bold text-emerald-700'}>{getAmountLabel(outstanding)}</span>
        </div>
      </div>
    </section>
  );
}

function Line({ label, value, strong = false, danger = false, info = false, success = false }: { label: string; value: string; strong?: boolean; danger?: boolean; info?: boolean; success?: boolean }) {
  const color = danger ? 'text-rose-700' : info ? 'text-blue-700' : success ? 'text-emerald-700' : 'text-foreground';
  return (
    <div className="flex justify-between border-b border-border/70 py-2">
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`${strong ? 'font-semibold' : 'font-medium'} ${color}`}>{value}</span>
    </div>
  );
}
