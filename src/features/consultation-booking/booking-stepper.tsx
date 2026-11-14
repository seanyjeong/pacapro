import { Check } from 'lucide-react';

interface BookingStepperProps {
  step: number;
}

const labels = ['정보 입력', '일정 선택', '확인'];

export function BookingStepper({ step }: BookingStepperProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${step >= item ? 'bg-primary text-white' : 'bg-border text-muted-foreground'}`}>
              {step > item ? <Check className="h-4 w-4" /> : item}
            </div>
            {item < 3 && <div className={`h-0.5 w-10 ${step > item ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-7 text-xs text-muted-foreground">
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  );
}
