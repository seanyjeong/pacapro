import { Building2, CheckCircle2, Clock3, CreditCard, ListChecks, WalletCards } from 'lucide-react';
import { ONBOARDING_STEPS } from './onboarding-constants';
import type { OnboardingStepId } from './onboarding-types';

const STEP_ICONS = {
  1: Building2,
  2: Clock3,
  3: WalletCards,
  4: CreditCard,
  5: ListChecks,
};

interface OnboardingStepRailProps {
  currentStep: OnboardingStepId;
}

export function OnboardingStepRail({ currentStep }: OnboardingStepRailProps) {
  return (
    <aside className="rounded-md border border-border bg-card p-3 lg:sticky lg:top-20 lg:self-start">
      <ol className="grid grid-cols-5 gap-2 lg:grid-cols-1">
        {ONBOARDING_STEPS.map((step) => {
          const Icon = STEP_ICONS[step.id];
          const completed = currentStep > step.id;
          const active = currentStep === step.id;

          return (
            <li
              key={step.id}
              className={[
                'min-w-0 rounded-md border px-2 py-3 transition lg:px-3',
                active ? 'border-slate-900 bg-slate-50' : 'border-transparent',
                completed ? 'bg-emerald-50 text-emerald-800' : 'text-muted-foreground',
              ].join(' ')}
            >
              <div className="flex flex-col items-center gap-2 text-center lg:flex-row lg:text-left">
                <span
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                    active ? 'border-slate-900 bg-slate-900 text-white' : 'border-border bg-background',
                    completed ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : '',
                  ].join(' ')}
                >
                  {completed ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold lg:hidden">{step.shortTitle}</span>
                  <span className="hidden text-sm font-semibold text-foreground lg:block">{step.title}</span>
                  <span className="hidden text-xs text-muted-foreground lg:block">{step.description}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
