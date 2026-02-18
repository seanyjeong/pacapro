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
import { Input } from '@/components/ui/input';
import { Banknote, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { paymentsAPI } from '@/lib/api/payments';
import type { PrepaidPreviewResponse, PrepaidMonthDetail } from '@/lib/types/payment';
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
const PAYMENT_METHODS = [
  { value: 'account', label: '계좌이체' },
  { value: 'card', label: '카드' },
  { value: 'cash', label: '현금' },
  { value: 'other', label: '기타' },
] as const;

function getStartMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    options.push({ value, label });
  }
  return options;
}

function generateMonths(startMonth: string, count: number): string[] {
  const [year, month] = startMonth.split('-').map(Number);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(year, month - 1 + i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

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
  const [startMonth, setStartMonth] = useState('');
  const [prepaidRate, setPrepaidRate] = useState('5');
  const [paymentMethod, setPaymentMethod] = useState<string>('account');
  const [paymentDate, setPaymentDate] = useState('');
  const [preview, setPreview] = useState<PrepaidPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const startMonthOptions = getStartMonthOptions();

  // 초기값 설정
  useEffect(() => {
    if (open) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      setStartMonth(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`);
      setPaymentDate(now.toISOString().split('T')[0]);
      setMonthCount(3);
      setPrepaidRate('5');
      setPaymentMethod('account');
      setPreview(null);
    }
  }, [open]);

  // 미리보기 호출
  const loadPreview = useCallback(async () => {
    if (!studentId || !startMonth || monthCount < 2) return;

    const rate = parseFloat(prepaidRate);
    if (isNaN(rate) || rate < 0 || rate > 50) return;

    const months = generateMonths(startMonth, monthCount);

    try {
      setPreviewLoading(true);
      const result = await paymentsAPI.prepaidPreview({
        student_id: studentId,
        months,
        prepaid_discount_rate: rate,
      });
      setPreview(result);
    } catch (err: any) {
      console.error('Preview failed:', err);
      toast.error(err.response?.data?.message || '미리보기에 실패했습니다.');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [studentId, startMonth, monthCount, prepaidRate]);

  useEffect(() => {
    if (open && startMonth) {
      const timer = setTimeout(loadPreview, 300);
      return () => clearTimeout(timer);
    }
  }, [open, startMonth, monthCount, prepaidRate, loadPreview]);

  // 결제 실행
  const handlePay = async () => {
    if (!preview || preview.months_payable === 0) return;

    const rate = parseFloat(prepaidRate);
    const months = generateMonths(startMonth, monthCount);

    try {
      setPaying(true);
      const result = await paymentsAPI.prepaidPay({
        student_id: studentId,
        months,
        prepaid_discount_rate: rate,
        payment_method: paymentMethod as 'account' | 'card' | 'cash' | 'other',
        payment_date: paymentDate,
      });
      toast.success(result.message);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Prepaid pay failed:', err);
      toast.error(err.response?.data?.message || '선납 결제에 실패했습니다.');
    } finally {
      setPaying(false);
    }
  };

  const statusLabel = (status: PrepaidMonthDetail['status']) => {
    switch (status) {
      case 'new': return null;
      case 'existing_unpaid': return <span className="text-xs text-amber-600 dark:text-amber-400">미납</span>;
      case 'already_paid': return <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">완납</span>;
    }
  };

  // 할인 전 정상가 합계 (payable 월만)
  const totalNormal = preview
    ? preview.months.filter(m => m.status !== 'already_paid').reduce((sum, m) => sum + m.base_amount - m.student_discount, 0)
    : 0;

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
          {/* 학생 정보 */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium">{studentName}</div>
            <div className="text-xs text-muted-foreground">
              월 수강료: {monthlyTuition.toLocaleString()}원
              {discountRate > 0 && ` (기본 할인 ${discountRate}%)`}
            </div>
          </div>

          {/* 선납 개월수 */}
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

          {/* 시작월 */}
          <div className="space-y-2">
            <Label htmlFor="startMonth">시작월</Label>
            <select
              id="startMonth"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {startMonthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 선납 할인율 */}
          <div className="space-y-2">
            <Label htmlFor="prepaidRate">선납 할인율 (%)</Label>
            <Input
              id="prepaidRate"
              type="number"
              min={0}
              max={50}
              step={1}
              value={prepaidRate}
              onChange={(e) => setPrepaidRate(e.target.value)}
              className="w-32"
            />
          </div>

          {/* 미리보기 결과 */}
          {previewLoading && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              계산 중...
            </div>
          )}

          {preview && !previewLoading && (
            <div className="space-y-3">
              <div className="text-sm font-medium">월별 내역</div>
              <div className="border rounded-lg divide-y">
                {preview.months.map((m) => (
                  <div
                    key={m.year_month}
                    className={`flex items-center justify-between px-3 py-2 text-sm ${
                      m.status === 'already_paid' ? 'opacity-50 bg-muted/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.year_month}</span>
                      {statusLabel(m.status)}
                    </div>
                    <div className="text-right">
                      {m.status === 'already_paid' ? (
                        <span className="text-gray-400 line-through">{m.base_amount.toLocaleString()}원</span>
                      ) : (
                        <div>
                          {m.prepaid_discount > 0 && (
                            <span className="text-xs text-muted-foreground line-through mr-2">
                              {(m.base_amount - m.student_discount).toLocaleString()}원
                            </span>
                          )}
                          <span className="font-medium">{m.final_amount.toLocaleString()}원</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 합계 */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>정상가 ({preview.months_payable}개월)</span>
                  <span>{totalNormal.toLocaleString()}원</span>
                </div>
                {preview.total_prepaid_discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>선납 할인 (-{preview.prepaid_discount_rate}%)</span>
                    <span>-{preview.total_prepaid_discount.toLocaleString()}원</span>
                  </div>
                )}
                <div className="border-t pt-1.5 flex justify-between font-semibold text-base">
                  <span>최종 납부</span>
                  <span>{preview.total_final.toLocaleString()}원</span>
                </div>
                {preview.months_already_paid > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {preview.months_already_paid}개월은 이미 완납되어 제외됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 납부 방법 */}
          <div className="space-y-2">
            <Label>납부 방법</Label>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Button
                  key={m.value}
                  type="button"
                  variant={paymentMethod === m.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaymentMethod(m.value)}
                  className="flex-1"
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 납부일 */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate">납부일</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-48"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={paying}>
            취소
          </Button>
          <Button
            onClick={handlePay}
            disabled={paying || !preview || preview.months_payable === 0}
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
