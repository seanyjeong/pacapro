import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { MobileSheet, mobileChoiceClass } from '../mobile-home/mobile-screen';
import { MOBILE_UNPAID_PAYMENT_METHODS } from './mobile-unpaid-constants';
import type { MobileUnpaidPaymentMethod, MobileUnpaidPaySheetState } from './mobile-unpaid-types';
import { formatAmount, getDisplayStudentName, getUnpaidAmount } from './mobile-unpaid-utils';

interface MobileUnpaidPaySheetProps {
  canViewAmount: boolean;
  paySheet: MobileUnpaidPaySheetState | null;
  processing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onMethodChange: (method: MobileUnpaidPaymentMethod) => void;
}

export function MobileUnpaidPaySheet({
  canViewAmount,
  paySheet,
  processing,
  onCancel,
  onConfirm,
  onMethodChange,
}: MobileUnpaidPaySheetProps) {
  if (!paySheet) return null;

  const { payment, method } = paySheet;
  const unpaidAmount = getUnpaidAmount(payment);
  const studentName = getDisplayStudentName(payment);

  return (
    <MobileSheet dialog testId="mobile-unpaid-pay-sheet" title="완납 처리" description={`${studentName} · ${payment.year_month}`}>
      {canViewAmount && (
        <div className="rounded-2xl bg-success-soft px-5 py-4">
          <p className="text-sm font-semibold text-success">받을 금액</p>
          <p className="mt-1 text-[26px] font-extrabold leading-tight text-success tabular-nums">{formatAmount(unpaidAmount)}원</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2" aria-label="결제 방법">
        {MOBILE_UNPAID_PAYMENT_METHODS.map((option) => {
          const Icon = option.icon;
          const active = method === option.value;
          return (
            <button
              type="button"
              key={option.value}
              aria-pressed={active}
              onClick={() => onMethodChange(option.value)}
              className={cn(mobileChoiceClass(active), 'flex h-16 flex-col items-center justify-center gap-1')}
            >
              <Icon className="h-5 w-5" />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={processing}>
          취소
        </Button>
        <Button type="button" size="lg" onClick={onConfirm} disabled={processing}>
          {processing ? '저장 중...' : '완납 저장'}
        </Button>
      </div>
    </MobileSheet>
  );
}
