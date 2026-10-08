import { Button } from '@/components/ui/button';
import type { LifecycleBillingPreviewState } from '@/hooks/use-lifecycle-billing-preview';
import type { LifecycleBillingSummary, LifecycleBillingRow } from '@/lib/types/lifecycle-billing';
import { formatLifecycleMoney } from '@/lib/utils/lifecycle-billing';

export function LifecycleBillingPreviewPanel({ preview, title = '학원비 처리 미리보기' }: {
  preview: LifecycleBillingPreviewState;
  title?: string;
}) {
  const { data, error, loading } = preview;
  return (
    <section className="space-y-3 rounded-md border border-border p-3" aria-label={title} aria-busy={loading}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {loading ? <p className="text-sm text-muted-foreground" role="status">실제 청구와 납부 내역을 확인하고 있습니다.</p> : null}
      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={preview.retry}>학원비 다시 확인</Button>
        </div>
      ) : null}
      {data ? (
        <>
          {data.days_before != null && data.days_month != null ? (
            <p className="text-sm text-muted-foreground">{data.billing_cutoff_date || data.date} 기준 전 {data.days_before}일 / 해당 월 {data.days_month}일</p>
          ) : null}
          {data.action === 'withdraw' && data.billing_cutoff_date ? (
            <p className="text-sm text-muted-foreground">학원비 계산 기준일: {data.billing_cutoff_date}</p>
          ) : null}
          <LifecycleBillingAmounts summary={data.summary} rows={data.rows} requiresPaymentReview={data.requires_payment_review} />
          <p className="text-xs text-muted-foreground">납부 이력은 보존됩니다. 환불은 별도 확인 후 처리합니다.</p>
        </>
      ) : null}
    </section>
  );
}


function LifecycleBillingAmounts({ summary, rows = [], requiresPaymentReview = false }: {
  summary: LifecycleBillingSummary; rows?: LifecycleBillingRow[]; requiresPaymentReview?: boolean;
}) {
  return (
    <>
          {requiresPaymentReview || rows.some(row => row.requires_payment_review) ? (
            <p className="text-sm text-destructive" role="alert">납부 상태와 기록된 납부액이 달라 확인이 필요합니다. 자동 환불·이월액은 산정하지 않습니다.</p>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm tabular-nums">
            {[
              ['원래 청구액', summary.original_amount],
              ['현재 청구액', summary.before_final_amount],
              ['달력 일할액', summary.prorated_amount],
              ['이미 납부한 금액', summary.paid_amount],
              ['처리 후 청구액', summary.adjusted_amount],
              ['처리 후 미납액', summary.outstanding_amount],
              ['감액', summary.waived_amount],
              ['미사용 납부액 (참고)', summary.refundable_amount],
            ].map(([label, amount]) => (
              <div key={String(label)} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={`break-words font-medium ${label === '처리 후 청구액' ? 'text-primary' : 'text-foreground'}`}>
                  {formatLifecycleMoney(amount)}
                </dd>
              </div>
            ))}
          </dl>
          {rows.length ? (
            <div className="max-h-40 space-y-2 overflow-y-auto border-t border-border pt-2 text-xs">
              {rows.map(row => (
                <div key={row.payment_id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 tabular-nums">
                  <span>{row.year_month} {row.payment_type === 'monthly' ? '월 학원비' : '청구'} #{row.payment_id}</span>
                  <span>{formatLifecycleMoney(row.before_final_amount)} → {formatLifecycleMoney(row.adjusted_amount)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">해당 범위에 청구 내역이 없습니다.</p>}
    </>
  );
}

export function LifecycleBillingResultPanel({ title, result }: {
  title: string;
  result: { summary?: LifecycleBillingSummary; rows?: LifecycleBillingRow[]; message: string; requires_payment_review?: boolean };
}) {
  return (
    <section className="space-y-3 rounded-md border border-border p-3" role="status" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm">{result.message}</p>
      {result.summary ? <LifecycleBillingAmounts summary={result.summary} rows={result.rows} requiresPaymentReview={result.requires_payment_review} /> : null}
      <p className="text-xs text-muted-foreground">납부 이력을 보존했습니다.</p>
    </section>
  );
}
