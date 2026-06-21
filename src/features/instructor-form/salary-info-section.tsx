import { MoneyInput } from '@/components/ui/money-input';
import type { InstructorFormData, InstructorType, SalaryType, TaxType } from '@/lib/types/instructor';
import {
  INSTRUCTOR_TYPE_OPTIONS,
  SALARY_TYPE_OPTIONS,
  TAX_TYPE_OPTIONS,
} from '@/lib/types/instructor';
import type { InstructorFormChangeHandler, InstructorFormErrors } from './instructor-form-types';
import { inputClassName } from './instructor-form-utils';

interface SalaryInfoSectionProps {
  formData: InstructorFormData;
  errors: InstructorFormErrors;
  onChange: InstructorFormChangeHandler;
}

export function SalaryInfoSection({ formData, errors, onChange }: SalaryInfoSectionProps) {
  const showHourlyRate = ['hourly', 'per_class', 'mixed'].includes(formData.salary_type);
  const showBaseSalary = formData.salary_type === 'monthly' || formData.salary_type === 'mixed';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          급여타입 <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.salary_type}
          onChange={(event) => onChange('salary_type', event.target.value as SalaryType)}
          className={inputClassName(errors.salary_type)}
        >
          {SALARY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.salary_type && <p className="text-red-500 text-sm mt-1">{errors.salary_type}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          세금타입 <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.tax_type}
          onChange={(event) => onChange('tax_type', event.target.value as TaxType)}
          className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {TAX_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {formData.salary_type === 'hourly' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            강사 유형 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.instructor_type || 'teacher'}
            onChange={(event) => onChange('instructor_type', event.target.value as InstructorType)}
            className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {INSTRUCTOR_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            수업강사: 수업 시간대별 출결 / 사무보조: 출퇴근 시간 기록
          </p>
        </div>
      )}

      {showHourlyRate && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {formData.salary_type === 'per_class' ? '수업료' : '시급'} <span className="text-red-500">*</span>
          </label>
          <MoneyInput
            value={formData.hourly_rate || 0}
            onChange={(value) => onChange('hourly_rate', value)}
            className={errors.hourly_rate ? 'border-red-500' : ''}
          />
          <p className="text-xs text-muted-foreground mt-1">100원 단위로 입력</p>
          {errors.hourly_rate && <p className="text-red-500 text-sm mt-1">{errors.hourly_rate}</p>}
        </div>
      )}

      {showBaseSalary && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            월급 <span className="text-red-500">*</span>
          </label>
          <MoneyInput
            value={formData.base_salary || 0}
            onChange={(value) => onChange('base_salary', value)}
            className={errors.base_salary ? 'border-red-500' : ''}
          />
          <p className="text-xs text-muted-foreground mt-1">1만원 단위</p>
          {errors.base_salary && <p className="text-red-500 text-sm mt-1">{errors.base_salary}</p>}
        </div>
      )}
    </div>
  );
}
