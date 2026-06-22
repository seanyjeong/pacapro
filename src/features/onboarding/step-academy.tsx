import { Building2 } from 'lucide-react';
import type { OnboardingFormData, UpdateOnboardingField } from './onboarding-types';

interface StepAcademyProps {
  formData: OnboardingFormData;
  updateFormData: UpdateOnboardingField;
}

const FIELD_CLASS =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30';

export function StepAcademy({ formData, updateFormData }: StepAcademyProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 p-4">
        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <div>
          <h3 className="text-sm font-semibold text-sky-950">운영 화면에 표시되는 기본 정보입니다</h3>
          <p className="mt-1 text-sm text-sky-900">
            학생, 강사, 상담 화면의 학원명과 기본 연락처에 사용됩니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="학원명" required>
          <input
            id="academy-name"
            className={FIELD_CLASS}
            placeholder="예: PACA 일산"
            type="text"
            value={formData.academy_name}
            onChange={(event) => updateFormData('academy_name', event.target.value)}
          />
        </Field>

        <Field label="대표 전화">
          <input
            id="academy-phone"
            className={FIELD_CLASS}
            placeholder="예: 031-900-0000"
            type="tel"
            value={formData.phone}
            onChange={(event) => updateFormData('phone', event.target.value)}
          />
        </Field>

        <Field label="주소">
          <input
            id="academy-address"
            className={FIELD_CLASS}
            placeholder="예: 경기 고양시 일산동구"
            type="text"
            value={formData.address}
            onChange={(event) => updateFormData('address', event.target.value)}
          />
        </Field>

        <Field label="사업자등록번호">
          <input
            id="academy-business-number"
            className={FIELD_CLASS}
            placeholder="예: 123-45-67890"
            type="text"
            value={formData.business_number}
            onChange={(event) => updateFormData('business_number', event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  children,
  label,
  required = false,
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  const id = label === '학원명' ? 'academy-name'
    : label === '대표 전화' ? 'academy-phone'
    : label === '주소' ? 'academy-address'
    : 'academy-business-number';

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </label>
      {children}
    </div>
  );
}
