/**
 * Payment Form Component
 * 학원비 청구 등록/수정 폼
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentFormData } from '@/lib/types/payment';
import { PAYMENT_TYPE_OPTIONS } from '@/lib/types/payment';
import { calculateFinalAmount, getCurrentYearMonth, getNextDueDate } from '@/lib/utils/payment-helpers';

interface PaymentFormProps {
  initialData?: Partial<PaymentFormData>;
  students: Array<{ id: number; name: string; student_number: string; monthly_tuition: number; discount_rate: number }>;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function PaymentForm({ initialData, students, onSubmit, onCancel, loading }: PaymentFormProps) {
  const [formData, setFormData] = useState<PaymentFormData>({
    student_id: initialData?.student_id || 0,
    payment_type: initialData?.payment_type || 'monthly',
    base_amount: Math.floor(initialData?.base_amount || 0),
    discount_amount: Math.floor(initialData?.discount_amount || 0),
    additional_amount: Math.floor(initialData?.additional_amount || 0),
    due_date: initialData?.due_date || getNextDueDate(),
    year_month: initialData?.year_month || getCurrentYearMonth(),
    description: initialData?.description || '',
    notes: initialData?.notes || '',
  });

  const handleStudentChange = (studentId: number) => {
    const student = students.find((s) => s.id === studentId);
    if (student && formData.payment_type === 'monthly') {
      const baseAmount = Math.floor(Number(student.monthly_tuition) || 0);
      const discountRate = Number(student.discount_rate) || 0;
      const discount = Math.floor(baseAmount * (discountRate / 100) / 1000) * 1000; // 천원단위 절삭
      setFormData({
        ...formData,
        student_id: studentId,
        base_amount: baseAmount,
        discount_amount: discount,
      });
    } else {
      setFormData({ ...formData, student_id: studentId });
    }
  };

  const finalAmount = calculateFinalAmount(
    formData.base_amount,
    formData.discount_amount,
    formData.additional_amount
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.student_id === 0) {
      toast.error('학생을 선택해주세요.');
      return;
    }
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>학원비 청구 {initialData ? '수정' : '등록'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학생 *</label>
            <select
              value={formData.student_id}
              onChange={(e) => handleStudentChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              required
              disabled={!!initialData}
            >
              <option value={0}>학생 선택</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.student_number})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구 유형 *</label>
              <select
                value={formData.payment_type}
                onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              >
                {PAYMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구 월 *</label>
              <input
                type="month"
                value={formData.year_month}
                onChange={(e) => setFormData({ ...formData, year_month: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기본 금액 *</label>
              <input
                type="number"
                value={formData.base_amount}
                onChange={(e) => setFormData({ ...formData, base_amount: Math.floor(Number(e.target.value)) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
                min="0"
                step="1000"
              />
              <p className="text-xs text-gray-500 mt-1">1천원 단위</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">할인 금액</label>
              <input
                type="number"
                value={formData.discount_amount}
                onChange={(e) => setFormData({ ...formData, discount_amount: Math.floor(Number(e.target.value)) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                min="0"
                step="1000"
              />
              <p className="text-xs text-gray-500 mt-1">1천원 단위</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">추가 금액</label>
              <input
                type="number"
                value={formData.additional_amount}
                onChange={(e) => setFormData({ ...formData, additional_amount: Math.floor(Number(e.target.value)) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                min="0"
                step="1000"
              />
              <p className="text-xs text-gray-500 mt-1">1천원 단위</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">최종 청구 금액:</span>{' '}
              {finalAmount.toLocaleString()}원
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">납부 기한 *</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="예: 2025년 1월 수강료"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              rows={3}
              placeholder="내부 메모"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '저장 중...' : initialData ? '수정' : '등록'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
