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
    <footer className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
      {validationMessage ? (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning" role="alert">
          {validationMessage}
        </p>
      ) : null}
      <div className="grid grid-cols-[1fr_2fr] gap-2 sm:flex sm:justify-end">
        <Button disabled={currentStep === 1 || submitting} size="lg" type="button" variant="outline" onClick={onPrevious}>
          <ArrowLeft className="h-4 w-4" />
          이전
        </Button>
        {isLastStep ? (
          <Button disabled={submitting} size="lg" type="button" onClick={onComplete}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            운영 시작
          </Button>
        ) : (
          <Button disabled={submitting} size="lg" type="button" onClick={onNext}>
            {currentStepInfo.nextLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </footer>
  );
}
