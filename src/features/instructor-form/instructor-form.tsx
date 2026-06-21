import type { FormEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
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
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submit error:', error);
      const errorMessage = getApiErrorMessage(error, '저장에 실패했습니다.');
      setErrors({ submit: errorMessage });
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{errors.submit}</p>
        </div>
      )}

      <FormActions mode={mode} submitting={submitting} onCancel={onCancel} />
    </form>
  );
}
