import type { InstructorFormData } from '@/lib/types/instructor';
import type { InstructorFormChangeHandler } from './instructor-form-types';

interface AccountInfoSectionProps {
  formData: InstructorFormData;
  onChange: InstructorFormChangeHandler;
}

export function AccountInfoSection({ formData, onChange }: AccountInfoSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">은행명</label>
        <input
          type="text"
          value={formData.bank_name || ''}
          onChange={(event) => onChange('bank_name', event.target.value)}
          placeholder="국민은행"
          className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">계좌번호</label>
        <input
          type="text"
          value={formData.account_number || ''}
          onChange={(event) => onChange('account_number', event.target.value)}
          placeholder="123-456-789012"
          className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}
