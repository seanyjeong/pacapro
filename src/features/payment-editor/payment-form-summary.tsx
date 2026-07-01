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
    {
      icon: WalletCards,
      label: '최종 금액',
      value: formatWon(finalAmount),
      subValue: `기본 ${formatWon(baseAmount)} - 할인 ${formatWon(discountAmount)} + 추가 ${formatWon(additionalAmount)}`,
    },
  ];

  return (
    <section className="rounded-md border border-border bg-card" data-testid="payment-form-summary">
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">청구 요약</h2>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="min-w-0 bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-foreground">{item.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.subValue}</p>
            </div>
          );
        })}
      </div>
      {paymentContext ? (
        <div className="grid gap-px border-t border-border bg-border sm:grid-cols-4">
          <SummaryStat label="현재 총 청구" value={formatWon(paymentContext.final_amount)} />
          <SummaryStat label="이미 납부" value={formatWon(settledAmount)} tone="text-emerald-700" />
          <SummaryStat label="현재 남은 금액" value={formatWon(currentRemainingAmount)} tone="text-rose-700" />
          <SummaryStat label="수정 후 남은 금액" value={formatWon(nextRemainingAmount)} tone="text-blue-700" />
        </div>
      ) : null}
    </section>
  );
}

function SummaryStat({ label, value, tone = 'text-foreground' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p>
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
