'use client';

import { useState } from 'react';
import { Edit3, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '@/components/ui/money-input';
import { apiErrorMessage } from '@/features/pay-rules/pay-rule-utils';
import { updateSalaryForPage } from './salary-detail-api';
import type { SalaryDetailWithRates } from './salary-detail-types';
import { formatCurrency, toNumber } from './salary-detail-utils';

const iconButton = 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted no-print';

/** 기본급 줄 — 출근·단가와 상관없이 금액을 직접 정할 수 있다(되돌리면 자동 계산) */
export function SalaryBaseOverride({ salary, onChanged }: { salary: SalaryDetailWithRates; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const overridden = salary.base_override !== null && salary.base_override !== undefined;

  const save = async (baseOverride: number | null) => {
    setSaving(true);
    try {
      await updateSalaryForPage(salary.id, { base_override: baseOverride });
      toast.success(baseOverride === null ? '자동 계산으로 되돌렸습니다.' : '기본급을 저장했습니다.');
      setEditing(false);
      onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, '기본급을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border/60 py-2">
      <span className="text-secondary-foreground">기본급{overridden ? ' (직접 입력)' : ''}</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <MoneyInput aria-label="기본급 직접 입력" value={value} onChange={setValue} className="h-10 w-36 text-sm" />
          <button type="button" aria-label="기본급 저장" disabled={saving} className="flex h-9 w-9 items-center justify-center rounded-lg text-success hover:bg-success-soft" onClick={() => void save(value)}><Save className="h-4 w-4" /></button>
          <button type="button" aria-label="기본급 수정 취소" className={iconButton} onClick={() => setEditing(false)}><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="font-bold tabular-nums text-foreground">{formatCurrency(salary.base_amount)}</span>
          {salary.payment_status === 'pending' ? (
            <>
              {overridden ? <button type="button" aria-label="기본급 자동 계산으로" title="자동 계산으로 되돌리기" disabled={saving} className={iconButton} onClick={() => void save(null)}><RotateCcw className="h-4 w-4" /></button> : null}
              <button type="button" aria-label="기본급 수정" className={iconButton} onClick={() => { setValue(overridden ? toNumber(salary.base_override) : toNumber(salary.base_amount)); setEditing(true); }}><Edit3 className="h-4 w-4" /></button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
