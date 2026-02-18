'use client';

import { useRouter } from 'next/navigation';
import { useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentCard } from '@/components/payments/payment-card';
import { PaymentRecordModal } from '@/components/payments/payment-record-modal';
import { usePayment } from '@/hooks/use-payments';
import { paymentsAPI } from '@/lib/api/payments';
import { usePermissions, isOwner } from '@/lib/utils/permissions';

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const paymentId = parseInt(id);
  const { payment, loading, error, reload } = usePayment(paymentId);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const { canEdit } = usePermissions();
  const canEditPayments = canEdit('payments');
  const canDeletePayments = isOwner(); // 삭제는 원장만

  const handleRecordPayment = async (data: { paid_amount: number; payment_method: string; paid_date: string; discount_amount?: number }) => {
    try {
      await paymentsAPI.recordPayment(paymentId, {
        paid_amount: data.paid_amount,
        payment_method: data.payment_method as 'account' | 'card' | 'cash' | 'other',
        paid_date: data.paid_date,
      });
      toast.success('납부가 기록되었습니다.');
      reload();
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      toast.error(err.response?.data?.message || '납부 기록에 실패했습니다.');
      throw err;
    }
  };

  const handleUpdatePaidDate = async (paidDate: string) => {
    try {
      await paymentsAPI.updatePayment(paymentId, { paid_date: paidDate } as any);
      toast.success('납부일이 수정되었습니다.');
      reload();
    } catch (err: any) {
      console.error('Failed to update paid date:', err);
      toast.error(err.response?.data?.message || '납부일 수정에 실패했습니다.');
      throw err;
    }
  };

  const handleEdit = () => {
    router.push(`/payments/${paymentId}/edit`);
  };

  const handleDelete = async () => {
    if (!confirm('이 학원비 청구를 삭제하시겠습니까?')) return;

    try {
      await paymentsAPI.deletePayment(paymentId);
      toast.success('삭제되었습니다.');
      router.push('/payments');
    } catch (err: any) {
      console.error('Failed to delete payment:', err);
      toast.error(err.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">학원비 상세</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">학원비 정보를 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">학원비 상세</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
            <p className="text-gray-600 mb-4">{error || '학원비 정보를 찾을 수 없습니다.'}</p>
            <Button onClick={reload}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">학원비 상세</h1>
        </div>
      </div>

      <PaymentCard
        payment={payment}
        onRecordPayment={canEditPayments && payment.payment_status !== 'paid' ? () => setShowRecordModal(true) : undefined}
        onEdit={canEditPayments ? handleEdit : undefined}
        onDelete={canDeletePayments ? handleDelete : undefined}
        onUpdatePaidDate={canEditPayments && payment.paid_date ? handleUpdatePaidDate : undefined}
      />

      {/* 납부 기록 모달 */}
      <PaymentRecordModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSubmit={handleRecordPayment}
        studentName={payment.student_name ?? ''}
        finalAmount={payment.final_amount}
        paidAmount={payment.paid_amount}
      />
    </div>
  );
}
