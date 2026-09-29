'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentFormData } from '@/lib/types/student';
import { STUDENT_PARENT_INFO_SECTION_ID, STUDENT_PARENT_NAME_FIELDS, STUDENT_PARENT_NAME_MAX_LENGTH } from '@/constants/student-parent-names';

interface ParentInfoSectionProps {
  formData: StudentFormData;
  errors: Record<string, string>;
  handleChange: (field: keyof StudentFormData, value: unknown) => void;
  formatPhoneNumber: (value: string) => string;
}

export function ParentInfoSection({ formData, errors, handleChange, formatPhoneNumber }: ParentInfoSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Student data loads after navigation, so the hash target may not exist during the initial scroll.
    if (window.location.hash === `#${STUDENT_PARENT_INFO_SECTION_ID}`) {
      sectionRef.current?.scrollIntoView({ block: 'start' });
    }
  }, []);

  return (
    <Card ref={sectionRef} id={STUDENT_PARENT_INFO_SECTION_ID} className="scroll-mt-24 rounded-md shadow-none">
      <CardHeader className="space-y-2">
        <CardTitle>보호자 정보</CardTitle>
        <p id="parent-info-help" className="text-sm leading-relaxed text-muted-foreground">
          부모님 성함과 전화번호를 각각 저장할 수 있습니다. 아는 정보만 입력해주세요.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
        {STUDENT_PARENT_NAME_FIELDS.map(({ field, label, phoneField, phoneLabel }) => (
          <div key={field} className="min-w-0 space-y-2">
            <label htmlFor={`field-${field}`} className="block text-sm font-medium">
              {label} <span className="ml-1 font-normal text-muted-foreground">(선택)</span>
            </label>
            <input id={`field-${field}`} type="text" value={formData[field] || ''}
              onChange={(event) => handleChange(field, event.target.value)}
              maxLength={STUDENT_PARENT_NAME_MAX_LENGTH} autoComplete="off" aria-describedby="parent-info-help"
              className="min-h-11 w-full rounded-md border border-border bg-background px-4 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            {formData.student_type === 'exam' && (
              <div className="space-y-2 pt-3">
                <label htmlFor={`field-${phoneField}`} className="block text-sm font-medium">
                  {phoneLabel} <span className="ml-1 font-normal text-muted-foreground">(선택)</span>
                </label>
                <input id={`field-${phoneField}`} type="tel" value={formData[phoneField] || ''}
                  onChange={(event) => handleChange(phoneField, formatPhoneNumber(event.target.value))}
                  placeholder="010-1234-5678" maxLength={13} autoComplete="off"
                  aria-invalid={Boolean(errors[phoneField])}
                  aria-describedby={errors[phoneField] ? `${phoneField}-error` : undefined}
                  className="min-h-11 w-full rounded-md border border-border bg-background px-4 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {errors[phoneField] && <p id={`${phoneField}-error`} className="text-sm text-red-500">{errors[phoneField]}</p>}
                <button type="button" disabled={!formData[phoneField]}
                  aria-pressed={Boolean(formData[phoneField] && formData.parent_phone === formData[phoneField])}
                  onClick={() => handleChange('parent_phone', formData[phoneField] || '')}
                  className="min-h-11 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                  {formData[phoneField] && formData.parent_phone === formData[phoneField] ? '대표 번호로 선택됨' : '대표 번호로 사용'}
                </button>
              </div>
            )}
          </div>
        ))}
        {formData.student_type === 'exam' && (
          <div className="min-w-0 space-y-2 border-t border-border pt-5 md:col-span-2">
            <label htmlFor="field-parent_phone" className="block text-sm font-medium">대표 학부모 전화번호</label>
            <input id="field-parent_phone" type="tel" value={formData.parent_phone || ''}
              onChange={(event) => handleChange('parent_phone', formatPhoneNumber(event.target.value))}
              placeholder="010-9876-5432" maxLength={13} aria-invalid={Boolean(errors.parent_phone)}
              aria-describedby={errors.parent_phone ? 'parent-phone-error' : 'parent-phone-help'}
              className="min-h-11 w-full rounded-md border border-border bg-background px-4 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            {errors.parent_phone && <p id="parent-phone-error" className="text-sm text-red-500">{errors.parent_phone}</p>}
            <p id="parent-phone-help" className="text-sm leading-relaxed text-muted-foreground">
              문자·알림을 받을 번호입니다. 부모님 번호 중 하나를 선택하거나 직접 입력해주세요.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
