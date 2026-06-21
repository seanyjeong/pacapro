'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManualCredit } from './manual-credit-types';
import { CREDIT_TYPE_LABELS } from './manual-credit-utils';

interface ManualCreditApplyDialogProps {
  applyingCredit: ManualCredit | null;
  applyYearMonth: string;
  applying: boolean;
  onApplyYearMonthChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export function ManualCreditApplyDialog({
  applyingCredit,
  applyYearMonth,
  applying,
  onApplyYearMonthChange,
  onClose,
  onApply,
}: ManualCreditApplyDialogProps) {
  return (
    <Dialog open={!!applyingCredit} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>크레딧 적용</DialogTitle>
          <DialogDescription>
            크레딧을 적용할 월을 선택하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 px-6 space-y-4">
          {applyingCredit && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted">
                  {CREDIT_TYPE_LABELS[applyingCredit.credit_type] || applyingCredit.credit_type}
                </span>
                <span className="text-sm font-medium">
                  {applyingCredit.remaining_amount.toLocaleString()}원
                </span>
              </div>
              {applyingCredit.notes && (
                <div className="text-xs text-muted-foreground">
                  {applyingCredit.notes}
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="applyYearMonth">적용할 월</Label>
            <Input
              id="applyYearMonth"
              type="month"
              value={applyYearMonth}
              onChange={(event) => onApplyYearMonthChange(event.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              해당 월 학원비에서 크레딧 금액만큼 차감됩니다.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={applying}>
            취소
          </Button>
          <Button
            onClick={onApply}
            disabled={applying || !applyYearMonth}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {applying ? '적용 중...' : '적용'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
