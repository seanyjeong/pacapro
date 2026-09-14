import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="fixed inset-0 z-50 flex items-end bg-zinc-950/45 px-3 pb-3" role="dialog" aria-modal="true" data-testid="mobile-unpaid-pay-sheet">
      <div className="w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">완납 처리</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {studentName} · {payment.year_month}
            </p>
          </div>
          {canViewAmount && (
            <p className="shrink-0 font-mono text-base font-semibold text-emerald-700 dark:text-emerald-300">
              {formatAmount(unpaidAmount)}원
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2" aria-label="결제 방법">
          {MOBILE_UNPAID_PAYMENT_METHODS.map((option) => {
            const Icon = option.icon;
            const active = method === option.value;
            return (
              <button
                type="button"
                key={option.value}
                onClick={() => onMethodChange(option.value)}
                className={`rounded-lg border px-2 py-3 text-sm font-medium transition
                  ${active
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'}`}
              >
                <Icon className="mx-auto mb-1 h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-12" onClick={onCancel} disabled={processing}>
            취소
          </Button>
          <Button type="button" className="h-12" onClick={onConfirm} disabled={processing}>
            {processing ? '저장 중...' : '완납 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
