import type { FormEvent } from 'react';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { InstructorFormData } from '@/lib/types/instructor';
import { AccountInfoSection } from './account-info-section';
import { AdditionalInfoSection } from './additional-info-section';
import { BasicInfoSection } from './basic-info-section';
import { FormActions } from './form-actions';
import { FormSection } from './form-section';
import { SalaryInfoSection } from './salary-info-section';
import { WorkSettingsSection } from './work-settings-section';
import type { InstructorFormErrors, InstructorFormProps } from './instructor-form-types';
import { buildInitialInstructorFormData, getApiErrorMessage } from './instructor-form-utils';

const SUBMIT_ERROR_MESSAGE = '강사 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';

export function InstructorForm({ mode, initialData, onSubmit, onCancel }: InstructorFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<InstructorFormErrors>({});
  const [formData, setFormData] = useState<InstructorFormData>(() => buildInitialInstructorFormData(initialData));

  const handleChange = <K extends keyof InstructorFormData>(field: K, value: InstructorFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: InstructorFormErrors = {};

    if (!formData.name.trim()) newErrors.name = '이름을 입력해주세요.';
    if (!formData.phone?.trim()) newErrors.phone = '전화번호를 입력해주세요.';
    if (!formData.hire_date) newErrors.hire_date = '입사일을 선택해주세요.';
    if (!formData.salary_type) newErrors.salary_type = '급여타입을 선택해주세요.';

    if (['hourly', 'per_class', 'mixed'].includes(formData.salary_type) && (!formData.hourly_rate || formData.hourly_rate <= 0)) {
      newErrors.hourly_rate = '시급/수업료를 입력해주세요.';
    }

    if ((formData.salary_type === 'monthly' || formData.salary_type === 'mixed') && (!formData.base_salary || formData.base_salary <= 0)) {
      newErrors.base_salary = '월급을 입력해주세요.';
    }

    if (formData.salary_type === 'hourly' && formData.instructor_type === 'assistant') {
      if (!formData.work_days || formData.work_days.length === 0) {
        newErrors.work_days = '출근 요일을 선택해주세요.';
      }
      if (!formData.work_start_time) newErrors.work_start_time = '출근 시간을 입력해주세요.';
      if (!formData.work_end_time) newErrors.work_end_time = '퇴근 시간을 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.submit;
        return next;
      });
      await onSubmit(formData);
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, SUBMIT_ERROR_MESSAGE);
      setErrors({ submit: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormSection title="기본 정보">
        <BasicInfoSection formData={formData} errors={errors} onChange={handleChange} />
      </FormSection>

      <FormSection title="급여 정보">
        <SalaryInfoSection formData={formData} errors={errors} onChange={handleChange} />
      </FormSection>

      <FormSection title="근무 설정" visible={formData.salary_type === 'hourly' && formData.instructor_type === 'assistant'}>
        <WorkSettingsSection formData={formData} errors={errors} onChange={handleChange} />
      </FormSection>

      <FormSection title="계좌 정보">
        <AccountInfoSection formData={formData} onChange={handleChange} />
      </FormSection>

      <FormSection title="추가 정보">
        <AdditionalInfoSection mode={mode} formData={formData} onChange={handleChange} />
      </FormSection>

      {errors.submit && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">저장 실패</h2>
              <p className="text-sm">{errors.submit}</p>
            </div>
          </div>
        </div>
      )}

      <FormActions mode={mode} submitting={submitting} onCancel={onCancel} />
    </form>
  );
}
