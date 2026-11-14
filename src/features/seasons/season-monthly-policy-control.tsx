import { ReceiptText } from 'lucide-react';
import {
  DEFAULT_SEASON_MONTHLY_POLICY,
  SEASON_MONTHLY_POLICY_OPTIONS,
  type SeasonMonthlyPolicy,
} from '@/lib/season-monthly-policy';
import { cn } from '@/lib/utils/cn';

interface SeasonMonthlyPolicyControlProps {
  value?: SeasonMonthlyPolicy;
  onChange: (value: SeasonMonthlyPolicy) => void;
}

export function SeasonMonthlyPolicyControl({ value, onChange }: SeasonMonthlyPolicyControlProps) {
  const currentValue = value || DEFAULT_SEASON_MONTHLY_POLICY;

  return (
    <div className="border-t border-border/60 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[15px] font-bold text-foreground">월납부 처리</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            이 시즌에 등록한 학생의 기존 월 학원비 처리 기준입니다.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
          시즌별
        </span>
      </div>
      <div role="radiogroup" aria-label="시즌별 월납부 처리 방식" className="grid gap-2 md:grid-cols-2">
        {SEASON_MONTHLY_POLICY_OPTIONS.map((option) => {
          const selected = currentValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-h-[86px] rounded-xl px-4 py-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                selected
                  ? 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50'
                  : 'bg-muted text-foreground hover:bg-muted/70'
              )}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block break-keep text-xs leading-5 text-muted-foreground">{option.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
