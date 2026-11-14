'use client';

import { CheckCircle2, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { OnboardingActions } from './onboarding-actions';
import { OnboardingStepRail } from './onboarding-step-rail';
import { StepAcademy } from './step-academy';
import { StepClassTime } from './step-class-time';
import { StepReview } from './step-review';
import { StepSettlement } from './step-settlement';
import { StepTuition } from './step-tuition';
import { useOnboardingState } from './use-onboarding-state';

export function OnboardingPage() {
  const state = useOnboardingState();

  if (state.loading) return <OnboardingLoading />;
  if (state.completed) return <OnboardingCompleted />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader
        title="초기 운영 설정"
        description="핵심 값만 먼저 맞추고, 나머지는 설정 메뉴에서 바꿀 수 있어요."
        actions={(
          <Button disabled={state.submitting} type="button" variant="outline" onClick={state.skip}>
            건너뛰기
          </Button>
        )}
      />

      {state.errorMessage ? (
        <section className="rounded-2xl bg-warning-soft px-4 py-3" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-warning">{state.errorMessage}</p>
            <Button className="w-full sm:w-auto" size="sm" type="button" variant="outline" onClick={state.reload}>
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </Button>
          </div>
        </section>
      ) : null}

      <OnboardingStepRail currentStep={state.currentStep} />

      <section className="min-w-0 rounded-2xl bg-card">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <p className="text-[13px] font-semibold text-primary tabular-nums">
            {state.currentStep}/5 단계
          </p>
          <h2 className="mt-1 text-[22px] font-extrabold tracking-tight text-foreground">{state.currentStepInfo.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{state.currentStepInfo.description}</p>
        </div>

        <div className="p-5 sm:p-6">
          <StepContent state={state} />
        </div>

        <OnboardingActions
          currentStep={state.currentStep}
          currentStepInfo={state.currentStepInfo}
          submitting={state.submitting}
          validationMessage={state.validationMessage}
          onComplete={state.complete}
          onNext={state.goNext}
          onPrevious={state.goPrevious}
        />
      </section>
    </div>
  );
}

function StepContent({ state }: { state: ReturnType<typeof useOnboardingState> }) {
  if (state.currentStep === 1) {
    return <StepAcademy formData={state.formData} updateFormData={state.updateFormData} />;
  }
  if (state.currentStep === 2) {
    return <StepClassTime formData={state.formData} updateFormData={state.updateFormData} />;
  }
  if (state.currentStep === 3) {
    return <StepTuition formData={state.formData} updateFormData={state.updateFormData} />;
  }
  if (state.currentStep === 4) {
    return <StepSettlement formData={state.formData} updateFormData={state.updateFormData} />;
  }
  return <StepReview formData={state.formData} updateFormData={state.updateFormData} />;
}

function OnboardingLoading() {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-3xl items-center justify-center rounded-2xl bg-card">
      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        초기 설정 정보를 불러오는 중이에요
      </div>
    </div>
  );
}

function OnboardingCompleted() {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-3xl items-center justify-center rounded-2xl bg-card p-8 text-center">
      <div className="flex flex-col items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h2 className="mt-5 text-[26px] font-extrabold tracking-tight text-foreground">설정이 저장되었습니다</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">이제 운영 대시보드에서 실제 데이터를 확인할 수 있어요.</p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm text-secondary-foreground">
          <Settings2 className="h-4 w-4" />
          세부 설정은 설정 메뉴에서 다시 바꿀 수 있어요.
        </p>
      </div>
    </div>
  );
}
