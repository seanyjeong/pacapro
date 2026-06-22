import type { Gender, InstructorFormData } from '@/lib/types/instructor';
import { GENDER_OPTIONS } from '@/lib/types/instructor';
import type { InstructorFormChangeHandler, InstructorFormErrors } from './instructor-form-types';
import { inputClassName } from './instructor-form-utils';

interface BasicInfoSectionProps {
  formData: InstructorFormData;
  errors: InstructorFormErrors;
  onChange: InstructorFormChangeHandler;
}

export function BasicInfoSection({ formData, errors, onChange }: BasicInfoSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="instructor-name" className="mb-2 block text-sm font-medium text-foreground">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          id="instructor-name"
          type="text"
          value={formData.name}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder="홍길동"
          className={inputClassName(errors.name)}
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="instructor-phone" className="mb-2 block text-sm font-medium text-foreground">
          전화번호 <span className="text-red-500">*</span>
        </label>
        <input
          id="instructor-phone"
          type="tel"
          value={formData.phone || ''}
          onChange={(event) => onChange('phone', event.target.value)}
          placeholder="010-1234-5678"
          className={inputClassName(errors.phone)}
        />
        {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="instructor-gender" className="mb-2 block text-sm font-medium text-foreground">성별</label>
        <select
          id="instructor-gender"
          value={formData.gender || ''}
          onChange={(event) => onChange('gender', event.target.value ? event.target.value as Gender : undefined)}
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">선택</option>
          {GENDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="instructor-email" className="mb-2 block text-sm font-medium text-foreground">이메일</label>
        <input
          id="instructor-email"
          type="email"
          value={formData.email || ''}
          onChange={(event) => onChange('email', event.target.value)}
          placeholder="instructor@example.com"
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label htmlFor="instructor-resident-number" className="mb-2 block text-sm font-medium text-foreground">주민번호</label>
        <input
          id="instructor-resident-number"
          type="text"
          value={formData.resident_number || ''}
          onChange={(event) => onChange('resident_number', event.target.value)}
          placeholder="000000-0000000"
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="text-xs text-muted-foreground mt-1">세무 신고용 (선택사항)</p>
      </div>

      <div>
        <label htmlFor="instructor-hire-date" className="mb-2 block text-sm font-medium text-foreground">
          입사일 <span className="text-red-500">*</span>
        </label>
        <input
          id="instructor-hire-date"
          type="date"
          value={formData.hire_date || ''}
          onChange={(event) => onChange('hire_date', event.target.value)}
          className={inputClassName(errors.hire_date)}
        />
        {errors.hire_date && <p className="text-red-500 text-sm mt-1">{errors.hire_date}</p>}
      </div>

      <div className="md:col-span-2">
        <label htmlFor="instructor-address" className="mb-2 block text-sm font-medium text-foreground">주소</label>
        <input
          id="instructor-address"
          type="text"
          value={formData.address || ''}
          onChange={(event) => onChange('address', event.target.value)}
          placeholder="서울시 강남구..."
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}
