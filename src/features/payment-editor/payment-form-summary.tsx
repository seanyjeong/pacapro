import { CalendarDays, ReceiptText, UserRound, WalletCards } from 'lucide-react';
import type { Payment, PaymentFormData } from '@/lib/types/payment';
import { getPaidPaymentAmount, getRemainingPaymentAmount } from '@/lib/utils/payment-helpers';
import { PAYMENT_TYPE_LABELS } from '@/lib/types/payment';
import type { PaymentFormStudent } from './payment-editor-types';

interface PaymentFormSummaryProps {
  finalAmount: number;
  formData: PaymentFormData;
  students: PaymentFormStudent[];
  paymentContext?: Payment;
}

export function PaymentFormSummary({ finalAmount, formData, students, paymentContext }: PaymentFormSummaryProps) {
  const student = students.find((item) => item.id === formData.student_id);
  const baseAmount = formData.base_amount || 0;
  const discountAmount = formData.discount_amount || 0;
  const additionalAmount = formData.additional_amount || 0;
  const settledAmount = getSettledAmount(paymentContext);
  const currentRemainingAmount = paymentContext ? getRemainingPaymentAmount(paymentContext) : 0;
  const nextRemainingAmount = paymentContext ? Math.max(finalAmount - settledAmount, 0) : 0;
  const items = [
    {
      icon: UserRound,
      label: '학생',
      value: student?.name || '학생 미선택',
      subValue: student?.student_number || '청구 대상을 선택하세요',
    },
    {
      icon: CalendarDays,
      label: '청구 월',
      value: formData.year_month || '월 미정',
      subValue: formData.due_date || '납부 기한 미정',
    },
    {
      icon: ReceiptText,
      label: '청구 유형',
      value: PAYMENT_TYPE_LABELS[formData.payment_type],
      subValue: formData.description || '설명 없음',
    },
  ];

  return (
    <section className="rounded-2xl bg-card p-5 sm:p-6" data-testid="payment-form-summary">
      <h2 className="text-[17px] font-bold tracking-tight text-foreground">청구 요약</h2>

      <div className="mt-3 rounded-xl bg-primary-soft px-4 py-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-primary">
          <WalletCards className="h-4 w-4" />
          최종 청구 금액
        </div>
        <p className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-primary tabular-nums">{formatWon(finalAmount)}</p>
        <p className="mt-1 break-keep text-[13px] text-primary/80 tabular-nums">
          기본 {formatWon(baseAmount)} - 할인 {formatWon(discountAmount)} + 추가 {formatWon(additionalAmount)}
        </p>
      </div>

      <div className="mt-2 divide-y divide-border/60">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex min-w-0 items-center gap-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-secondary-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground">{item.label}</p>
                <p className="truncate text-[15px] font-semibold text-foreground">{item.value}</p>
              </div>
              <p className="max-w-[45%] truncate text-right text-[13px] text-muted-foreground">{item.subValue}</p>
            </div>
          );
        })}
      </div>

      {paymentContext ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SummaryStat label="현재 총 청구" value={formatWon(paymentContext.final_amount)} />
          <SummaryStat label="이미 납부" value={formatWon(settledAmount)} tone="text-success" />
          <SummaryStat label="현재 남은 금액" value={formatWon(currentRemainingAmount)} tone="text-destructive" />
          <SummaryStat label="수정 후 남은 금액" value={formatWon(nextRemainingAmount)} tone="text-primary" />
        </div>
      ) : null}
    </section>
  );
}

function SummaryStat({ label, value, tone = 'text-foreground' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-3">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-[16px] font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function getSettledAmount(payment: Payment | undefined) {
  if (!payment) return 0;
  const paidAmount = getPaidPaymentAmount(payment);
  if (paidAmount > 0) return paidAmount;
  return Math.max((Number(payment.final_amount) || 0) - getRemainingPaymentAmount(payment), 0);
}

function formatWon(value: number) {
  return `${Math.max(0, value).toLocaleString()}원`;
}
