'use client';

import { CheckCircle2, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Operations Setup</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">초기 운영 설정</h1>
          <p className="text-sm text-muted-foreground">
            파카 운영에 필요한 핵심 값을 먼저 맞추고, 이후 설정 메뉴에서 세부 조정할 수 있습니다.
          </p>
        </div>
        <Button disabled={state.submitting} type="button" variant="outline" onClick={state.skip}>
          건너뛰기
        </Button>
      </header>

      {state.errorMessage ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-amber-950">{state.errorMessage}</p>
            <Button className="w-full sm:w-auto" size="sm" type="button" variant="outline" onClick={state.reload}>
              <RefreshCw className="mr-2 h-4 w-4" />
              다시 시도
            </Button>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <OnboardingStepRail currentStep={state.currentStep} />

        <section className="min-w-0 rounded-md border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Step {state.currentStep} of 5
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-foreground">{state.currentStepInfo.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{state.currentStepInfo.description}</p>
          </div>

          <div className="p-5">
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
    <div className="mx-auto flex min-h-[420px] w-full max-w-7xl items-center justify-center rounded-md border border-border bg-card">
      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        초기 설정 정보를 불러오는 중입니다
      </div>
    </div>
  );
}

function OnboardingCompleted() {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-3xl items-center justify-center rounded-md border border-border bg-card p-8 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Setup Complete</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">설정이 저장되었습니다</h2>
          <p className="mt-2 text-sm text-muted-foreground">이제 운영 대시보드에서 실제 데이터를 확인할 수 있습니다.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          세부 설정은 설정 메뉴에서 다시 수정 가능합니다.
        </div>
      </div>
    </div>
  );
}
