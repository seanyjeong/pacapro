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
        <label htmlFor="instructor-bank-name" className="mb-2 block text-sm font-semibold text-foreground">은행명</label>
        <input
          id="instructor-bank-name"
          type="text"
          value={formData.bank_name || ''}
          onChange={(event) => onChange('bank_name', event.target.value)}
          placeholder="국민은행"
          className="min-h-11 w-full rounded-xl border border-transparent bg-muted px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
      </div>

      <div>
        <label htmlFor="instructor-account-number" className="mb-2 block text-sm font-semibold text-foreground">계좌번호</label>
        <input
          id="instructor-account-number"
          type="text"
          value={formData.account_number || ''}
          onChange={(event) => onChange('account_number', event.target.value)}
          placeholder="123-456-789012"
          className="min-h-11 w-full rounded-xl border border-transparent bg-muted px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
      </div>
    </div>
  );
}
