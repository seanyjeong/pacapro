'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PaymentForm } from '@/components/payments/payment-form';
import { paymentsAPI } from '@/lib/api/payments';
import { studentsAPI } from '@/lib/api/students';
import type { PaymentFormData } from '@/lib/types/payment';
import { Card, CardContent } from '@/components/ui/card';

export default function NewPaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const data = await studentsAPI.getStudents({ status: 'active' });
      setStudents(data.students);
    } catch (err) {
      console.error('Failed to load students:', err);
      toast.error('학생 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSubmit = async (data: PaymentFormData) => {
    try {
      setLoading(true);
      await paymentsAPI.createPayment(data);
      toast.success('학원비가 성공적으로 청구되었습니다.');
      router.push('/payments');
    } catch (err: any) {
      console.error('Failed to create payment:', err);
      toast.error(err.response?.data?.message || '학원비 청구에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loadingStudents) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">학원비 청구</h1>
          <p className="text-gray-600 mt-1">새로운 학원비 청구 등록</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">학생 목록을 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">학원비 청구</h1>
        <p className="text-gray-600 mt-1">새로운 학원비 청구 등록</p>
      </div>

      <PaymentForm
        students={students}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={loading}
      />
    </div>
  );
}
