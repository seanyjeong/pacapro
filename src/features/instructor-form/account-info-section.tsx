import type { InstructorFormData } from '@/lib/types/instructor';
import type { InstructorFormChangeHandler } from './instructor-form-types';

interface AccountInfoSectionProps {
  formData: InstructorFormData;
  onChange: InstructorFormChangeHandler;
}

export function AccountInfoSection({ formData, onChange }: AccountInfoSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="instructor-bank-name" className="mb-2 block text-sm font-medium text-foreground">은행명</label>
        <input
          id="instructor-bank-name"
          type="text"
          value={formData.bank_name || ''}
          onChange={(event) => onChange('bank_name', event.target.value)}
          placeholder="국민은행"
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label htmlFor="instructor-account-number" className="mb-2 block text-sm font-medium text-foreground">계좌번호</label>
        <input
          id="instructor-account-number"
          type="text"
          value={formData.account_number || ''}
          onChange={(event) => onChange('account_number', event.target.value)}
          placeholder="123-456-789012"
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}
