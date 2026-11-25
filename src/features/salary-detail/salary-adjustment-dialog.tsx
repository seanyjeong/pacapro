'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Switch } from '@/components/ui/switch';
import type { SalaryAdjustment } from '@/lib/types/salary';
import type { AdjustmentPayload } from './salary-detail-api';

export type AdjustmentMode = 'add' | 'edit' | 'match';

interface SalaryAdjustmentDialogProps {
  mode: AdjustmentMode;
  adjustment?: SalaryAdjustment | null;
  netSalary: number;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AdjustmentPayload) => void;
}

const TITLES: Record<AdjustmentMode, string> = { add: '조정 추가', edit: '조정 수정', match: '실수령액 맞추기' };
const moneyClass = 'h-11 rounded-xl border-transparent bg-muted text-[15px] font-semibold tabular-nums';

export function SalaryAdjustmentDialog({ mode, adjustment, netSalary, saving, onClose, onSave }: SalaryAdjustmentDialogProps) {
  const matching = mode === 'match';
  const [label, setLabel] = useState(adjustment?.label ?? (matching ? '실수령액 맞춤' : ''));
  const [minus, setMinus] = useState((adjustment?.amount ?? 0) < 0);
  const [amount, setAmount] = useState(matching ? netSalary : Math.abs(adjustment?.amount ?? 0));
  const [taxable, setTaxable] = useState(adjustment ? Boolean(Number(adjustment.taxable)) : true);
  const [memo, setMemo] = useState(adjustment?.memo ?? '');

  const submit = () => {
    if (!label.trim()) {
      toast.error('항목명을 적어 주세요.');
      return;
    }
    // 실수령액 맞추기는 서버가 차이를 계산해 세금에 넣지 않는 조정을 만든다
    if (matching) {
      if (amount % 10 !== 0) {
        toast.error('실수령액은 10원 단위로 입력해 주세요.');
        return;
      }
      onSave({ label: label.trim(), target_net: amount, memo: memo.trim() || null });
      return;
    }
    const value = minus ? -amount : amount;
    if (value === 0) {
      toast.error('금액을 입력해 주세요.');
      return;
    }
    onSave({ label: label.trim(), amount: value, taxable, memo: memo.trim() || null });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          {matching ? <DialogDescription>적은 금액이 실수령액이 되게 차이만큼 조정을 넣어요. 세금은 바뀌지 않아요.</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4 px-6 py-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground" htmlFor="adjustment-label">항목명</label>
            <Input id="adjustment-label" maxLength={100} placeholder="예: 인센티브, 차감, 보너스" value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground" htmlFor="adjustment-amount">{matching ? '실수령액' : '금액'}</label>
            <div className="flex gap-2">
              {matching ? null : (
                <div className="grid w-28 shrink-0 grid-cols-2 gap-1" role="group" aria-label="더하기 빼기">
                  {[{ value: false, text: '+', name: '더하기' }, { value: true, text: '−', name: '빼기' }].map((option) => (
                    <button
                      key={option.name}
                      type="button"
                      aria-label={option.name}
                      aria-pressed={minus === option.value}
                      className={`h-11 rounded-xl text-lg font-bold transition ${minus === option.value ? 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50' : 'bg-muted text-secondary-foreground'}`}
                      onClick={() => setMinus(option.value)}
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <MoneyInput id="adjustment-amount" className={moneyClass} value={amount} onChange={setAmount} />
              </div>
            </div>
          </div>
          {matching ? null : (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm" htmlFor="adjustment-taxable">
              <span className="font-semibold text-foreground">세금 계산에 넣기</span>
              <Switch id="adjustment-taxable" checked={taxable} onCheckedChange={setTaxable} />
            </label>
          )}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground" htmlFor="adjustment-memo">메모</label>
            <Input id="adjustment-memo" maxLength={500} placeholder="사유" value={memo} onChange={(event) => setMemo(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>취소</Button>
          <Button type="button" disabled={saving} onClick={submit}>{saving ? '저장 중' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
