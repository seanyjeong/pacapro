/**
 * Instructor Form Component
 * 강사 등록/수정 폼 컴포넌트 (공용)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Instructor, InstructorFormData, InstructorType, Gender } from '@/lib/types/instructor';
import {
  SALARY_TYPE_OPTIONS,
  TAX_TYPE_OPTIONS,
  INSTRUCTOR_STATUS_OPTIONS,
  INSTRUCTOR_TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
  GENDER_OPTIONS,
} from '@/lib/types/instructor';

interface InstructorFormProps {
  mode: 'create' | 'edit';
  initialData?: Instructor;
  onSubmit: (data: InstructorFormData) => Promise<void>;
  onCancel: () => void;
}

export function InstructorForm({ mode, initialData, onSubmit, onCancel }: InstructorFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // work_days 파싱 헬퍼
  const parseWorkDays = (workDays: number[] | string | null | undefined): number[] => {
    if (!workDays) return [];
    if (Array.isArray(workDays)) return workDays;
    try {
      return JSON.parse(workDays);
    } catch {
      return [];
    }
  };

  // 폼 데이터 초기화
  const [formData, setFormData] = useState<InstructorFormData>({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    gender: initialData?.gender || undefined,
    email: initialData?.email || '',
    resident_number: initialData?.resident_number || '',
    hire_date: initialData?.hire_date || new Date().toISOString().split('T')[0],
    salary_type: initialData?.salary_type || 'hourly',
    instructor_type: initialData?.instructor_type || 'teacher',
    hourly_rate: initialData?.hourly_rate ? parseFloat(initialData.hourly_rate) : 0,
    base_salary: initialData?.base_salary ? parseFloat(initialData.base_salary) : 0,
    tax_type: initialData?.tax_type || '3.3%',
    bank_name: initialData?.bank_name || '',
    account_number: initialData?.account_number || '',
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    status: initialData?.status || 'active',
    work_days: parseWorkDays(initialData?.work_days),
    work_start_time: initialData?.work_start_time || '09:00',
    work_end_time: initialData?.work_end_time || '18:00',
  });

  // 입력값 변경 핸들러
  const handleChange = (field: keyof InstructorFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // 에러 초기화
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // 유효성 검사
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    if (!formData.phone || !formData.phone.trim()) {
      newErrors.phone = '전화번호를 입력해주세요.';
    }

    if (!formData.hire_date) {
      newErrors.hire_date = '입사일을 선택해주세요.';
    }

    if (!formData.salary_type) {
      newErrors.salary_type = '급여타입을 선택해주세요.';
    }

    // 급여타입에 따른 유효성 검사
    if (formData.salary_type === 'hourly' || formData.salary_type === 'per_class' || formData.salary_type === 'mixed') {
      if (!formData.hourly_rate || formData.hourly_rate <= 0) {
        newErrors.hourly_rate = '시급/수업료를 입력해주세요.';
      }
    }

    if (formData.salary_type === 'monthly' || formData.salary_type === 'mixed') {
      if (!formData.base_salary || formData.base_salary <= 0) {
        newErrors.base_salary = '월급을 입력해주세요.';
      }
    }

    // 사무보조일 때 근무 설정 필수
    if (formData.salary_type === 'hourly' && formData.instructor_type === 'assistant') {
      if (!formData.work_days || formData.work_days.length === 0) {
        newErrors.work_days = '출근 요일을 선택해주세요.';
      }
      if (!formData.work_start_time) {
        newErrors.work_start_time = '출근 시간을 입력해주세요.';
      }
      if (!formData.work_end_time) {
        newErrors.work_end_time = '퇴근 시간을 입력해주세요.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setSubmitting(true);
      await onSubmit(formData);
    } catch (err: any) {
      console.error('Form submit error:', err);
      setErrors({ submit: err.response?.data?.message || '저장에 실패했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="홍길동"
                className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.name ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="010-1234-5678"
                className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.phone ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">성별</label>
              <select
                value={formData.gender || ''}
                onChange={(e) => handleChange('gender', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">선택</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">이메일</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="instructor@example.com"
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 주민번호 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">주민번호</label>
              <input
                type="text"
                value={formData.resident_number}
                onChange={(e) => handleChange('resident_number', e.target.value)}
                placeholder="000000-0000000"
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-muted-foreground mt-1">세무 신고용 (선택사항)</p>
            </div>

            {/* 입사일 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                입사일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.hire_date}
                onChange={(e) => handleChange('hire_date', e.target.value)}
                className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.hire_date ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.hire_date && <p className="text-red-500 text-sm mt-1">{errors.hire_date}</p>}
            </div>

            {/* 주소 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">주소</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="서울시 강남구..."
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 급여 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>급여 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 급여타입 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                급여타입 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.salary_type}
                onChange={(e) => handleChange('salary_type', e.target.value)}
                className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.salary_type ? 'border-red-500' : 'border-border'
                }`}
              >
                {SALARY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.salary_type && <p className="text-red-500 text-sm mt-1">{errors.salary_type}</p>}
            </div>

            {/* 세금타입 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                세금타입 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tax_type}
                onChange={(e) => handleChange('tax_type', e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {TAX_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 강사 유형 (시급제일 때만 표시) */}
            {formData.salary_type === 'hourly' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  강사 유형 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.instructor_type || 'teacher'}
                  onChange={(e) => handleChange('instructor_type', e.target.value as InstructorType)}
                  className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {INSTRUCTOR_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  수업강사: 수업 시간대별 출결 / 사무보조: 출퇴근 시간 기록
                </p>
              </div>
            )}

            {/* 시급/수업료 (조건부 표시) */}
            {(formData.salary_type === 'hourly' ||
              formData.salary_type === 'per_class' ||
              formData.salary_type === 'mixed') && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {formData.salary_type === 'per_class' ? '수업료' : '시급'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.hourly_rate}
                  onChange={(e) => handleChange('hourly_rate', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="100"
                  className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.hourly_rate ? 'border-red-500' : 'border-border'
                  }`}
                />
                <p className="text-xs text-muted-foreground mt-1">100원 단위로 입력</p>
                {errors.hourly_rate && <p className="text-red-500 text-sm mt-1">{errors.hourly_rate}</p>}
              </div>
            )}

            {/* 월급 (조건부 표시) */}
            {(formData.salary_type === 'monthly' || formData.salary_type === 'mixed') && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  월급 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.base_salary}
                  onChange={(e) => handleChange('base_salary', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="10000"
                  className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.base_salary ? 'border-red-500' : 'border-border'
                  }`}
                />
                <p className="text-xs text-muted-foreground mt-1">1만원 단위</p>
                {errors.base_salary && <p className="text-red-500 text-sm mt-1">{errors.base_salary}</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 사무보조 근무 설정 (시급제 + 사무보조일 때만) */}
      {formData.salary_type === 'hourly' && formData.instructor_type === 'assistant' && (
        <Card>
          <CardHeader>
            <CardTitle>근무 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 출근 요일 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                출근 요일 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      const currentDays = formData.work_days || [];
                      const newDays = currentDays.includes(day.value)
                        ? currentDays.filter((d) => d !== day.value)
                        : [...currentDays, day.value].sort((a, b) => a - b);
                      handleChange('work_days', newDays);
                    }}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      (formData.work_days || []).includes(day.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {errors.work_days && <p className="text-red-500 text-sm mt-1">{errors.work_days}</p>}
            </div>

            {/* 근무 시간 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  출근 시간 <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.work_start_time || '09:00'}
                  onChange={(e) => handleChange('work_start_time', e.target.value)}
                  className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.work_start_time ? 'border-red-500' : 'border-border'
                  }`}
                />
                {errors.work_start_time && <p className="text-red-500 text-sm mt-1">{errors.work_start_time}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  퇴근 시간 <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.work_end_time || '18:00'}
                  onChange={(e) => handleChange('work_end_time', e.target.value)}
                  className={`w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.work_end_time ? 'border-red-500' : 'border-border'
                  }`}
                />
                {errors.work_end_time && <p className="text-red-500 text-sm mt-1">{errors.work_end_time}</p>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              설정된 근무 시간 외 출근 또는 초과 근무 시 관리자 승인이 필요합니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 계좌 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>계좌 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 은행명 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">은행명</label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="국민은행"
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 계좌번호 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">계좌번호</label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
                placeholder="123-456-789012"
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 추가 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>추가 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">메모</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="특이사항이나 메모를 입력하세요..."
              rows={4}
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 상태 (수정 모드일 때만) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">상태</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {INSTRUCTOR_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {errors.submit && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{errors.submit}</p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex items-center justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? '저장 중...' : mode === 'create' ? '등록' : '수정'}
        </Button>
      </div>
    </form>
  );
}
