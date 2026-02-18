'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Banknote, CheckCircle, Loader2 } from 'lucide-react';
import { paymentsAPI } from '@/lib/api/payments';
import type { PrepaidPreviewResponse } from '@/lib/types/payment';
import { toast } from 'sonner';

interface PrepaidPaymentModalProps {
  open: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  monthlyTuition: number;
  discountRate?: number;
  onSuccess: () => void;
}

const MONTH_COUNTS = [2, 3, 4, 5, 6];

export function PrepaidPaymentModal({
  open,
  onClose,
  studentId,
  studentName,
  monthlyTuition,
  discountRate = 0,
  onSuccess,
}: PrepaidPaymentModalProps) {
  const [monthCount, setMonthCount] = useState(3);
  const [preview, setPreview] = useState<PrepaidPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMonthCount(3);
      setPreview(null);
    }
  }, [open]);

  // Load preview
  const loadPreview = useCallback(async () => {
    if (!studentId || monthCount < 2) return;

    try {
      setPreviewLoading(true);
      const result = await paymentsAPI.prepaidPreview({
        student_id: studentId,
        months: monthCount,
      });
      setPreview(result);
    } catch (err: any) {
      console.error('Preview failed:', err);
      toast.error('미리보기에 실패했습니다.');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [studentId, monthCount]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(loadPreview, 300);
      return () => clearTimeout(timer);
    }
  }, [open, monthCount, loadPreview]);

  // Execute payment
  const handlePay = async () => {
    if (!preview) return;

    try {
      setPaying(true);
      await paymentsAPI.prepaidPay({
        student_id: studentId,
        months: monthCount,
        amount: preview.final_amount,
      });
      toast.success(`${studentName}님 ${monthCount}개월 선납 완료`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Prepaid pay failed:', err);
      toast.error('선납 결제에 실패했습니다.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            선납 할인 결제
          </DialogTitle>
          <DialogDescription>
            여러 달 학원비를 한번에 납부하고 선납 할인을 받습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 px-6 space-y-5">
          {/* Student info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium">{studentName}</div>
            <div className="text-xs text-muted-foreground">
              월 수강료: {monthlyTuition.toLocaleString()}원
              {discountRate > 0 && ` (기본 할인 ${discountRate}%)`}
            </div>
          </div>

          {/* Month count */}
          <div className="space-y-2">
            <Label>선납 개월수</Label>
            <div className="flex gap-2">
              {MONTH_COUNTS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={monthCount === n ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMonthCount(n)}
                  className="flex-1"
                >
                  {n}개월
                </Button>
              ))}
            </div>
          </div>

          {/* Preview loading */}
          {previewLoading && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              계산 중...
            </div>
          )}

          {/* Preview result */}
          {preview && !previewLoading && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>월 수강료</span>
                <span>{preview.monthly_tuition.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>정상가 ({preview.months}개월)</span>
                <span>{preview.total_without_discount.toLocaleString()}원</span>
              </div>
              {preview.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>선납 할인 (-{preview.discount_rate}%)</span>
                  <span>-{preview.discount_amount.toLocaleString()}원</span>
                </div>
              )}
              <div className="border-t pt-1.5 flex justify-between font-semibold text-base">
                <span>최종 납부</span>
                <span>{preview.final_amount.toLocaleString()}원</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={paying}>
            취소
          </Button>
          <Button
            onClick={handlePay}
            disabled={paying || !preview}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {paying ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                선납 결제 확정
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
