'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentFormData, Gender } from '@/lib/types/student';
import { GENDER_OPTIONS } from '@/lib/types/student';

interface BasicInfoSectionProps {
  mode: 'create' | 'edit';
  formData: StudentFormData;
  errors: Record<string, string>;
  handleChange: (field: keyof StudentFormData, value: unknown) => void;
  formatPhoneNumber: (value: string) => string;
}

export function BasicInfoSection({ mode, formData, errors, handleChange, formatPhoneNumber }: BasicInfoSectionProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader><CardTitle>기본 정보</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              이름 <span className="text-red-500">*</span>
            </label>
            <input type="text" id="field-name" value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="홍길동"
              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.name ? 'border-red-500' : 'border-border'
              }`} />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">성별</label>
            <div className="flex gap-4">
              {GENDER_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center">
                  <input type="radio" name="gender" value={option.value}
                    checked={formData.gender === option.value}
                    onChange={(e) => handleChange('gender', e.target.value as Gender)}
                    className="mr-2 text-primary-600 focus:ring-primary-500" />
                  <span className="text-foreground">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 학번 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              학번 {mode === 'create' && <span className="text-muted-foreground text-xs">(자동생성 가능)</span>}
            </label>
            <input type="text" value={formData.student_number || ''}
              onChange={(e) => handleChange('student_number', e.target.value)}
              placeholder="2024001"
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input type="tel" id="field-phone" value={formData.phone}
              onChange={(e) => handleChange('phone', formatPhoneNumber(e.target.value))}
              placeholder="010-1234-5678" maxLength={13}
              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.phone ? 'border-red-500' : 'border-border'
              }`} />
            <p className="text-xs text-muted-foreground mt-1">하이픈(-) 포함 형식으로 입력하세요</p>
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>

          {/* 학부모 전화번호 - 입시생일 때만 */}
          {formData.student_type === 'exam' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">학부모 전화번호</label>
              <input type="tel" value={formData.parent_phone || ''}
                onChange={(e) => handleChange('parent_phone', formatPhoneNumber(e.target.value))}
                placeholder="010-9876-5432" maxLength={13}
                className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.parent_phone ? 'border-red-500' : 'border-border'
                }`} />
              <p className="text-xs text-muted-foreground mt-1">하이픈(-) 포함 형식으로 입력하세요</p>
              {errors.parent_phone && <p className="text-red-500 text-sm mt-1">{errors.parent_phone}</p>}
            </div>
          )}

          {/* 학교 - 입시생일 때만 */}
          {formData.student_type === 'exam' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">학교</label>
              <input type="text" value={formData.school || ''}
                onChange={(e) => handleChange('school', e.target.value)}
                placeholder="서울고등학교"
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
