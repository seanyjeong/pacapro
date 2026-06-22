'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentFormData, StudentType, Grade, AdmissionType } from '@/lib/types/student';
import { STUDENT_TYPE_OPTIONS, GRADE_OPTIONS } from '@/lib/types/student';

interface StudentTypeSectionProps {
  formData: StudentFormData;
  errors: Record<string, string>;
  admissionOptions: { value: string; label: string }[];
  handleChange: (field: keyof StudentFormData, value: unknown) => void;
}

export function StudentTypeSection({ formData, errors, admissionOptions, handleChange }: StudentTypeSectionProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader><CardTitle>학생 유형</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 학생 유형 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              학생 유형 <span className="text-red-500">*</span>
            </label>
            <select value={formData.student_type}
              onChange={(e) => handleChange('student_type', e.target.value as StudentType)}
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              {STUDENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* 학년 - 입시생일 때만 */}
          {formData.student_type === 'exam' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                학년 <span className="text-red-500">*</span>
              </label>
              <select id="field-grade" value={formData.grade || ''}
                onChange={(e) => handleChange('grade', e.target.value as Grade || undefined)}
                className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.grade ? 'border-red-500' : 'border-border'
                }`}>
                <option value="">선택하세요</option>
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.grade && <p className="text-red-500 text-sm mt-1">{errors.grade}</p>}
            </div>
          )}

          {/* 나이 - 성인일 때만 */}
          {formData.student_type === 'adult' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                나이 <span className="text-red-500">*</span>
              </label>
              <input type="number" id="field-age" value={formData.age || ''}
                onChange={(e) => handleChange('age', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="25" min="1" max="100"
                className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.age ? 'border-red-500' : 'border-border'
                }`} />
              {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
            </div>
          )}

          {/* 입시유형 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {formData.student_type === 'exam' ? '입시유형' : '목표'}
            </label>
            <select value={formData.admission_type}
              onChange={(e) => handleChange('admission_type', e.target.value as AdmissionType)}
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              {admissionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
