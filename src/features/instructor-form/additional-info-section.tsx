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
        <label htmlFor="instructor-notes" className="mb-2 block text-sm font-medium text-foreground">메모</label>
        <textarea
          id="instructor-notes"
          value={formData.notes || ''}
          onChange={(event) => onChange('notes', event.target.value)}
          placeholder="특이사항이나 메모를 입력하세요..."
          rows={4}
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {mode === 'edit' && (
        <div>
          <label htmlFor="instructor-status" className="mb-2 block text-sm font-medium text-foreground">상태</label>
          <select
            id="instructor-status"
            value={formData.status}
            onChange={(event) => onChange('status', event.target.value as InstructorStatus)}
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
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
