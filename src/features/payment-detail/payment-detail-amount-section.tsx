import type { Payment } from '@/lib/types/payment';
import { getAmountLabel, getOutstandingAmount, getSettledAmount } from './payment-detail-utils';

export function PaymentDetailAmountSection({ payment }: { payment: Payment }) {
  const outstanding = getOutstandingAmount(payment);
  const settled = getSettledAmount(payment);
  const hasPartialPayment = settled > 0 && outstanding > 0;

  return (
    <section className="rounded-md border border-border/70 bg-card">
      <div className="border-b border-border/70 bg-muted/35 p-3">
        <h2 className="text-sm font-semibold text-foreground">수납 계산</h2>
      </div>
      <div className="space-y-3 p-4 text-sm">
        {hasPartialPayment ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            <p className="font-semibold">부분납부 진행 중</p>
            <p className="mt-1 text-xs">총 청구 {getAmountLabel(payment.final_amount)} 중 {getAmountLabel(settled)} 수납, {getAmountLabel(outstanding)} 남음</p>
          </div>
        ) : null}
        <div>
          <Line label="기본 금액" value={getAmountLabel(payment.base_amount)} />
          {payment.discount_amount > 0 ? <Line label="할인 금액" value={`-${getAmountLabel(payment.discount_amount)}`} danger /> : null}
          {payment.additional_amount > 0 ? <Line label={payment.notes?.includes('비시즌 종강 일할') ? '비시즌 종강 일할' : '추가 금액'} value={`+${getAmountLabel(payment.additional_amount)}`} info /> : null}
          <Line label="총 청구 금액" value={getAmountLabel(payment.final_amount)} strong />
          <Line label="이미 납부한 금액" value={getAmountLabel(settled)} success />
        </div>
        <div className="mt-3 flex justify-between rounded-md bg-muted/40 px-3 py-3">
          <span className="font-semibold text-foreground">남은 납부 금액</span>
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
