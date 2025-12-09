'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Copy, Printer, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';

interface RefundData {
  // 기본 정보
  paidAmount: number;
  originalFee: number;
  discountAmount: number;

  // 수업일 정보
  totalClassDays: number;
  attendedDays: number;
  remainingDays: number;
  progressRate: string;

  // 일할계산 기준
  usedAmount: number;
  usedRate: string;
  refundAmount: number;
  refundRate: string;

  // 부가세 옵션
  includeVat: boolean;
  vatAmount: number;
  refundAfterVat: number;

  // 학원법 기준
  legalRefundRate: string;
  legalRefundReason: string;
  legalRefundAmount: number;

  // 최종
  finalRefundAmount: number;

  // 상세
  calculationDetails: {
    paidAmount: string;
    perClassFee: string;
    usedFormula: string;
    refundFormula: string;
    vatFormula: string | null;
  };
}

interface EnrollmentInfo {
  id: number;
  student_name: string;
  season_name: string;
  season_start_date: string;
  season_end_date: string;
  original_fee: number;
  discount_amount: number;
  paid_amount: number;
  payment_status: string;
}

interface AcademyInfo {
  academy_name?: string;
  phone?: string;
  address?: string;
}

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollment: EnrollmentInfo | null;
  cancellationDate: string;
  refund: RefundData | null;
  academy: AcademyInfo;
  onConfirm: (includeVat: boolean, finalAmount: number) => Promise<void>;
  loading?: boolean;
}

export function RefundModal({
  isOpen,
  onClose,
  enrollment,
  cancellationDate,
  refund,
  academy,
  onConfirm,
  loading = false,
}: RefundModalProps) {
  const [includeVat, setIncludeVat] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!enrollment || !refund) return null;

  const finalAmount = includeVat ? refund.refundAfterVat : refund.refundAmount;
  const progressPercent = parseFloat(refund.progressRate);
  const isOverHalf = progressPercent >= 50;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + '원';
  };

  const handleCopy = async () => {
    const text = `
[환불 명세서]
학원: ${academy.academy_name || 'P-ACA'}
학생: ${enrollment.student_name}
시즌: ${enrollment.season_name}

[기간 정보]
시즌 기간: ${formatDate(enrollment.season_start_date)} ~ ${formatDate(enrollment.season_end_date)}
퇴원일: ${formatDate(cancellationDate)}

[수업일 계산]
전체 수업일: ${refund.totalClassDays}일
이용 수업일: ${refund.attendedDays}일 (${refund.usedRate}%)
남은 수업일: ${refund.remainingDays}일 (${refund.refundRate}%)

[금액 계산]
납부 금액: ${formatCurrency(refund.paidAmount)}
이용 금액: ${formatCurrency(refund.usedAmount)}
환불 금액: ${formatCurrency(refund.refundAmount)}
${includeVat ? `부가세 (10%): -${formatCurrency(refund.vatAmount)}` : ''}
${includeVat ? `최종 환불금: ${formatCurrency(refund.refundAfterVat)}` : ''}

[학원법 기준 참고]
진행률 ${refund.progressRate}% - ${refund.legalRefundReason}
학원법 기준 환불금: ${formatCurrency(refund.legalRefundAmount)}

최종 환불금액: ${formatCurrency(finalAmount)}
    `.trim();

    try {
      await navigator.clipboard.writeText(text);
      toast.success('클립보드에 복사되었습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>환불 명세서 - ${enrollment.student_name}</title>
        <style>
          body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 24px; margin-bottom: 10px; }
          .header p { color: #666; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
          .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
          .row.highlight { background: #f5f5f5; font-weight: bold; }
          .warning { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
          .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; padding: 10px; background: #e3f2fd; border-radius: 5px; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>환불 명세서</h1>
          <p>${academy.academy_name || 'P-ACA'}</p>
          ${academy.phone ? `<p>연락처: ${academy.phone}</p>` : ''}
        </div>

        <div class="section">
          <div class="section-title">학생 정보</div>
          <div class="row"><span>학생명</span><span>${enrollment.student_name}</span></div>
          <div class="row"><span>시즌</span><span>${enrollment.season_name}</span></div>
          <div class="row"><span>시즌 기간</span><span>${formatDate(enrollment.season_start_date)} ~ ${formatDate(enrollment.season_end_date)}</span></div>
          <div class="row"><span>퇴원일</span><span>${formatDate(cancellationDate)}</span></div>
        </div>

        <div class="section">
          <div class="section-title">수업일 계산</div>
          <div class="row"><span>전체 수업일</span><span>${refund.totalClassDays}일</span></div>
          <div class="row"><span>이용 수업일</span><span>${refund.attendedDays}일 (${refund.usedRate}%)</span></div>
          <div class="row"><span>남은 수업일</span><span>${refund.remainingDays}일 (${refund.refundRate}%)</span></div>
        </div>

        <div class="section">
          <div class="section-title">금액 계산</div>
          <div class="row"><span>납부 금액</span><span>${formatCurrency(refund.paidAmount)}</span></div>
          <div class="row"><span>이용 금액 (${refund.usedRate}%)</span><span>${formatCurrency(refund.usedAmount)}</span></div>
          <div class="row"><span>환불 금액</span><span>${formatCurrency(refund.refundAmount)}</span></div>
          ${includeVat ? `<div class="row"><span>부가세 제외 (10%)</span><span>-${formatCurrency(refund.vatAmount)}</span></div>` : ''}
        </div>

        ${isOverHalf ? `
        <div class="warning">
          <strong>학원법 기준 안내</strong><br>
          진행률 ${refund.progressRate}% - ${refund.legalRefundReason}<br>
          학원법 기준 환불금: ${formatCurrency(refund.legalRefundAmount)}
        </div>
        ` : ''}

        <div class="total">
          최종 환불금액: ${formatCurrency(finalAmount)}
        </div>

        <div class="footer">
          발행일: ${new Date().toLocaleDateString('ko-KR')}<br>
          P-ACA 학원관리시스템
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(includeVat, finalAmount);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>환불 명세서</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-4 py-4 px-2">
          {/* 학생 정보 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">학생 정보</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600">학생명</div>
              <div className="font-medium">{enrollment.student_name}</div>
              <div className="text-gray-600">시즌</div>
              <div className="font-medium">{enrollment.season_name}</div>
              <div className="text-gray-600">시즌 기간</div>
              <div className="font-medium text-xs">
                {formatDate(enrollment.season_start_date)} ~ {formatDate(enrollment.season_end_date)}
              </div>
              <div className="text-gray-600">퇴원일</div>
              <div className="font-medium text-red-600">{formatDate(cancellationDate)}</div>
            </div>
          </div>

          {/* 수업일 계산 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">수업일 계산</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600">전체 수업일</div>
              <div className="font-medium">{refund.totalClassDays}일</div>
              <div className="text-gray-600">이용 수업일</div>
              <div className="font-medium">{refund.attendedDays}일 ({refund.usedRate}%)</div>
              <div className="text-gray-600">남은 수업일</div>
              <div className="font-medium text-blue-600">{refund.remainingDays}일 ({refund.refundRate}%)</div>
            </div>
            {/* 진행률 바 */}
            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressPercent >= 50 ? 'bg-red-500' : progressPercent >= 33 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span className="text-yellow-600">33%</span>
                <span className="text-red-600">50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* 금액 계산 */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">금액 계산</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">납부 금액</span>
                <span className="font-medium">{formatCurrency(refund.paidAmount)}</span>
              </div>
              {refund.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>(원래 시즌비: {formatCurrency(refund.originalFee)}, 할인: -{formatCurrency(refund.discountAmount)})</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">이용 금액 ({refund.usedRate}%)</span>
                <span className="font-medium text-red-600">-{formatCurrency(refund.usedAmount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-gray-600">환불 금액</span>
                <span className="font-bold">{formatCurrency(refund.refundAmount)}</span>
              </div>
            </div>
          </div>

          {/* 부가세 옵션 */}
          <div className="border rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeVat}
                onChange={(e) => setIncludeVat(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <div className="font-medium">부가세 10% 제외</div>
                <div className="text-xs text-gray-500">
                  카드 결제 후 현금 환불 시 (매출 세금 고려)
                </div>
              </div>
            </label>
            {includeVat && (
              <div className="mt-3 pl-8 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>환불 금액</span>
                  <span>{formatCurrency(refund.refundAmount)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>부가세 (10%)</span>
                  <span>-{formatCurrency(refund.vatAmount)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>부가세 제외 후</span>
                  <span>{formatCurrency(refund.refundAfterVat)}</span>
                </div>
              </div>
            )}
          </div>

          {/* 학원법 기준 안내 */}
          {isOverHalf && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-yellow-800">학원법 기준 안내</div>
                  <div className="text-sm text-yellow-700 mt-1">
                    진행률 {refund.progressRate}% - {refund.legalRefundReason}
                  </div>
                  <div className="text-sm text-yellow-700">
                    학원법 기준 환불금: <strong>{formatCurrency(refund.legalRefundAmount)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 최종 환불금액 */}
          <div className="bg-primary-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">최종 환불금액</span>
              <span className="text-2xl font-bold text-primary-600">
                {formatCurrency(finalAmount)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleCopy} className="flex-1 sm:flex-none">
              <Copy className="w-4 h-4 mr-2" />
              복사
            </Button>
            <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
              <Printer className="w-4 h-4 mr-2" />
              인쇄
            </Button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || loading}
              className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700"
            >
              {confirming || loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              환불 확정
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
