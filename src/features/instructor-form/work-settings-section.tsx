import { WEEKDAY_OPTIONS } from '@/lib/types/instructor';
import type { InstructorFormData } from '@/lib/types/instructor';
import type { InstructorFormChangeHandler, InstructorFormErrors } from './instructor-form-types';
import { inputClassName } from './instructor-form-utils';

interface WorkSettingsSectionProps {
  formData: InstructorFormData;
  errors: InstructorFormErrors;
  onChange: InstructorFormChangeHandler;
}

export function WorkSettingsSection({ formData, errors, onChange }: WorkSettingsSectionProps) {
  if (formData.salary_type !== 'hourly' || formData.instructor_type !== 'assistant') return null;

  const workDays = formData.work_days || [];

  return (
    <>
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          출근 요일 <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((day) => {
            const active = workDays.includes(day.value);
            const nextDays = active
              ? workDays.filter((value) => value !== day.value)
              : [...workDays, day.value].sort((a, b) => a - b);

            return (
              <button
                key={day.value}
                type="button"
                onClick={() => onChange('work_days', nextDays)}
                className={`rounded-md border px-4 py-2 transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {errors.work_days && <p className="text-red-500 text-sm mt-1">{errors.work_days}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="instructor-work-start-time" className="mb-2 block text-sm font-medium text-foreground">
            출근 시간 <span className="text-red-500">*</span>
          </label>
          <input
            id="instructor-work-start-time"
            type="time"
            value={formData.work_start_time || '09:00'}
            onChange={(event) => onChange('work_start_time', event.target.value)}
            className={inputClassName(errors.work_start_time)}
          />
          {errors.work_start_time && <p className="text-red-500 text-sm mt-1">{errors.work_start_time}</p>}
        </div>
        <div>
          <label htmlFor="instructor-work-end-time" className="mb-2 block text-sm font-medium text-foreground">
            퇴근 시간 <span className="text-red-500">*</span>
          </label>
          <input
            id="instructor-work-end-time"
            type="time"
            value={formData.work_end_time || '18:00'}
            onChange={(event) => onChange('work_end_time', event.target.value)}
            className={inputClassName(errors.work_end_time)}
          />
          {errors.work_end_time && <p className="text-red-500 text-sm mt-1">{errors.work_end_time}</p>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        설정된 근무 시간 외 출근 또는 초과 근무 시 관리자 승인이 필요합니다.
      </p>
    </>
  );
}
