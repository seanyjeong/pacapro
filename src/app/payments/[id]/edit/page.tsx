'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentForm } from '@/components/payments/payment-form';
import { paymentsAPI } from '@/lib/api/payments';
import { studentsAPI } from '@/lib/api/students';
import { usePayment } from '@/hooks/use-payments';
import type { PaymentFormData } from '@/lib/types/payment';

export default function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const paymentId = parseInt(id);
  const { payment, loading: paymentLoading, error: paymentError } = usePayment(paymentId);
  const [saving, setSaving] = useState(false);
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
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSubmit = async (data: PaymentFormData) => {
    try {
      setSaving(true);
      await paymentsAPI.updatePayment(paymentId, data);
      toast.success('학원비가 수정되었습니다.');
      router.push(`/payments/${paymentId}`);
    } catch (err: any) {
      console.error('Failed to update payment:', err);
      toast.error(err.response?.data?.message || '학원비 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const loading = paymentLoading || loadingStudents;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">학원비 수정</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">데이터를 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentError || !payment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">학원비 수정</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
            <p className="text-gray-600 mb-4">{paymentError || '학원비 정보를 찾을 수 없습니다.'}</p>
            <Button onClick={() => router.push('/payments')}>목록으로</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initialData: Partial<PaymentFormData> = {
    student_id: payment.student_id,
    payment_type: payment.payment_type,
    base_amount: Math.floor(Number(payment.base_amount) || 0),
    discount_amount: Math.floor(Number(payment.discount_amount) || 0),
    additional_amount: Math.floor(Number(payment.additional_amount) || 0),
    due_date: payment.due_date?.split('T')[0] || payment.due_date,
    year_month: payment.year_month,
    description: payment.description || '',
    notes: payment.notes || '',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">학원비 수정</h1>
          <p className="text-gray-600 mt-1">{payment.student_name}님의 학원비 정보 수정</p>
        </div>
      </div>

      <PaymentForm
        initialData={initialData}
        students={students}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={saving}
      />
    </div>
  );
}
