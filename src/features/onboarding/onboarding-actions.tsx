import { ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ONBOARDING_STEPS } from './onboarding-constants';
import type { OnboardingStepDefinition, OnboardingStepId } from './onboarding-types';

interface OnboardingActionsProps {
  currentStep: OnboardingStepId;
  currentStepInfo: OnboardingStepDefinition;
  submitting: boolean;
  validationMessage: string | null;
  onComplete: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function OnboardingActions({
  currentStep,
  currentStepInfo,
  submitting,
  validationMessage,
  onComplete,
  onNext,
  onPrevious,
}: OnboardingActionsProps) {
  const isLastStep = currentStep === ONBOARDING_STEPS.length;

  return (
    <footer className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-5 text-sm text-amber-700" role={validationMessage ? 'alert' : undefined}>
        {validationMessage}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={currentStep === 1 || submitting} type="button" variant="outline" onClick={onPrevious}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          이전
        </Button>
        {isLastStep ? (
          <Button disabled={submitting} type="button" onClick={onComplete}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            운영 시작
          </Button>
        ) : (
          <Button disabled={submitting} type="button" onClick={onNext}>
            {currentStepInfo.nextLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </footer>
  );
}
