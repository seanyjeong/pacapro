import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface BookingStepperProps {
  step: number;
}

const labels = ['정보 입력', '일정 선택', '확인'];

export function BookingStepper({ step }: BookingStepperProps) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="예약 단계">
      {labels.map((label, index) => {
        const item = index + 1;
        const done = step > item;
        const current = step === item;
        return (
          <li key={label} className="min-w-0" aria-current={current ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full transition-colors', step >= item ? 'bg-primary' : 'bg-border')} />
            <p
              className={cn(
                'mt-2 flex items-center gap-1 truncate text-[13px] font-semibold',
                current ? 'text-foreground' : done ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {done ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="tabular-nums">{item}</span>}
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
