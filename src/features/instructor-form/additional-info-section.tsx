import type { InstructorFormData, InstructorStatus } from '@/lib/types/instructor';
import { INSTRUCTOR_STATUS_OPTIONS } from '@/lib/types/instructor';
import type { InstructorFormChangeHandler } from './instructor-form-types';

interface AdditionalInfoSectionProps {
  mode: 'create' | 'edit';
  formData: InstructorFormData;
  onChange: InstructorFormChangeHandler;
}

export function AdditionalInfoSection({ mode, formData, onChange }: AdditionalInfoSectionProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">메모</label>
        <textarea
          value={formData.notes || ''}
          onChange={(event) => onChange('notes', event.target.value)}
          placeholder="특이사항이나 메모를 입력하세요..."
          rows={4}
          className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {mode === 'edit' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">상태</label>
          <select
            value={formData.status}
            onChange={(event) => onChange('status', event.target.value as InstructorStatus)}
            className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {INSTRUCTOR_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
