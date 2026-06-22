import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { onboardingAPI } from '@/lib/api/onboarding';
import { DEFAULT_ONBOARDING_FORM, ONBOARDING_STEPS } from './onboarding-constants';
import type { OnboardingField, OnboardingFormData, OnboardingStepId } from './onboarding-types';
import { buildOnboardingPayload, formFromOnboardingData, getStepValidationMessage } from './onboarding-utils';

const LOAD_ERROR_MESSAGE = '초기 설정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const SAVE_ERROR_MESSAGE = '설정을 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.';
const SKIP_ERROR_MESSAGE = '초기 설정 건너뛰기에 실패했습니다. 잠시 후 다시 시도해주세요.';

export function useOnboardingState() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStepId>(1);
  const [formData, setFormData] = useState<OnboardingFormData>(DEFAULT_ONBOARDING_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const currentStepInfo = useMemo(
    () => ONBOARDING_STEPS.find((step) => step.id === currentStep) ?? ONBOARDING_STEPS[0],
    [currentStep],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await onboardingAPI.getData({ suppressErrorToast: true });
      setFormData(formFromOnboardingData(data));
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
      setErrorMessage(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateFormData = useCallback(
    <K extends OnboardingField>(field: K, value: OnboardingFormData[K]) => {
      setFormData((previous) => ({ ...previous, [field]: value }));
      setValidationMessage(null);
    },
    [],
  );

  const goNext = useCallback(() => {
    const message = getStepValidationMessage(currentStep, formData);
    if (message) {
      setValidationMessage(message);
      return;
    }
    setCurrentStep((previous) => Math.min(previous + 1, ONBOARDING_STEPS.length) as OnboardingStepId);
  }, [currentStep, formData]);

  const goPrevious = useCallback(() => {
    setValidationMessage(null);
    setCurrentStep((previous) => Math.max(previous - 1, 1) as OnboardingStepId);
  }, []);

  const complete = useCallback(async () => {
    const message = getStepValidationMessage(1, formData);
    if (message) {
      setCurrentStep(1);
      setValidationMessage(message);
      return;
    }

    setSubmitting(true);
    setValidationMessage(null);
    setErrorMessage(null);
    try {
      await onboardingAPI.complete(buildOnboardingPayload(formData), { suppressErrorToast: true });
      if (formData.create_sample_data) {
        await onboardingAPI.createSampleData({ suppressErrorToast: true });
      }
      setCompleted(true);
      toast.success('설정이 저장되었습니다.');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setErrorMessage(SAVE_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }, [formData]);

  const skip = useCallback(async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onboardingAPI.skip({ suppressErrorToast: true });
      router.push('/');
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      setErrorMessage(SKIP_ERROR_MESSAGE);
      setSubmitting(false);
    }
  }, [router]);

  return {
    complete,
    completed,
    currentStep,
    currentStepInfo,
    errorMessage,
    formData,
    goNext,
    goPrevious,
    loading,
    reload: loadData,
    skip,
    submitting,
    updateFormData,
    validationMessage,
  };
}
