'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentFormData } from '@/lib/types/student';
import type { AcademySettings } from '../_types';
import { MoneyInput } from '@/components/ui/money-input';

interface TuitionSectionProps {
  isTrial: boolean;
  formData: StudentFormData;
  errors: Record<string, string>;
  finalTuition: number;
  academySettings: AcademySettings;
  handleChange: (field: keyof StudentFormData, value: unknown) => void;
  formatCurrency: (amount: number) => string;
}

export function TuitionSection({
  isTrial, formData, errors, finalTuition, academySettings, handleChange, formatCurrency,
}: TuitionSectionProps) {
  if (isTrial) return null;

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader><CardTitle>학원비 정보</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 월 학원비 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              월 학원비 <span className="text-muted-foreground text-xs">(수업횟수에 따라 자동 설정)</span>
            </label>
            <MoneyInput
              value={formData.monthly_tuition}
              onChange={(monthly_tuition) => handleChange('monthly_tuition', monthly_tuition)}
              className="focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-muted-foreground mt-1">1만원 단위</p>
          </div>

          {/* 할인율 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">할인율 (%)</label>
            <input type="number" value={formData.discount_rate || ''}
              onChange={(e) => handleChange('discount_rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              placeholder="0" min="0" max="100" step="1"
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-right" />
          </div>

          {/* 납부일 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              납부일 <span className="text-muted-foreground text-xs">(비워두면 학원 기본값 사용)</span>
            </label>
            <select value={formData.payment_due_day || ''}
              onChange={(e) => handleChange('payment_due_day', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">학원 기본값 ({academySettings.tuition_due_day || 5}일)</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>매월 {day}일</option>
              ))}
            </select>
          </div>
        </div>

        {/* 할인 사유 - 할인율이 있을 때만 */}
        {(formData.discount_rate || 0) > 0 && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              할인 사유 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={formData.discount_reason || ''}
              onChange={(e) => handleChange('discount_reason', e.target.value)}
              placeholder="예: 형제자매 할인, 장기등록 할인, 추천인 할인 등"
              className={`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.discount_reason ? 'border-red-500' : 'border-border'
              }`} />
            {errors.discount_reason && <p className="text-red-500 text-sm mt-1">{errors.discount_reason}</p>}
          </div>
        )}

        {/* 실납부액 표시 */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">월 학원비</span>
            <span className="font-medium text-foreground">{formatCurrency(formData.monthly_tuition || 0)}</span>
          </div>
          {(formData.discount_rate || 0) > 0 && (
            <div className="flex justify-between items-center text-red-600 mt-2">
              <span>할인 ({formData.discount_rate}%)</span>
              <span>-{formatCurrency(Math.round((formData.monthly_tuition || 0) * ((formData.discount_rate || 0) / 100)))}</span>
            </div>
          )}
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
            <span className="font-semibold text-foreground">실납부액</span>
            <span className="font-bold text-lg text-primary-600">{formatCurrency(finalTuition)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
