import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ONBOARDING_STEPS } from './onboarding-constants';
import type { OnboardingStepId } from './onboarding-types';

interface OnboardingStepRailProps {
  currentStep: OnboardingStepId;
}

/** 5단계 진행 막대. 휴대폰은 짧은 이름, PC 는 단계 이름. */
export function OnboardingStepRail({ currentStep }: OnboardingStepRailProps) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="설정 단계">
      {ONBOARDING_STEPS.map((step) => {
        const completed = currentStep > step.id;
        const active = currentStep === step.id;

        return (
          <li key={step.id} className="min-w-0" aria-current={active ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full transition-colors', currentStep >= step.id ? 'bg-primary' : 'bg-border')} />
            <p
              className={cn(
                'mt-2 flex items-center gap-1 truncate text-[13px] font-semibold',
                active ? 'text-foreground' : completed ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {completed ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="tabular-nums">{step.id}</span>}
              <span className="truncate sm:hidden">{step.shortTitle}</span>
              <span className="hidden truncate sm:inline">{step.title}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
