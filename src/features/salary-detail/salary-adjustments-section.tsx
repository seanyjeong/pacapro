'use client';

import { useState } from 'react';
import { Edit3, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/page';
import { apiErrorMessage } from '@/features/pay-rules/pay-rule-utils';
import type { SalaryAdjustment } from '@/lib/types/salary';
import { formatSignedWon } from '@/lib/utils/salary-lines';
import { SalaryAdjustmentDialog, type AdjustmentMode } from './salary-adjustment-dialog';
import { addSalaryAdjustment, deleteSalaryAdjustment, updateSalaryAdjustment, type AdjustmentPayload } from './salary-detail-api';
import type { SalaryDetailWithRates } from './salary-detail-types';
import { toNumber } from './salary-detail-utils';

interface SalaryAdjustmentsSectionProps {
  salary: SalaryDetailWithRates;
  adjustments: SalaryAdjustment[];
  onChanged: () => void;
}

export function SalaryAdjustmentsSection({ salary, adjustments, onChanged }: SalaryAdjustmentsSectionProps) {
  const [dialog, setDialog] = useState<{ mode: AdjustmentMode; adjustment: SalaryAdjustment | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = salary.payment_status === 'pending';

  const run = async (work: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      setDialog(null);
      onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, failed));
    } finally {
      setBusy(false);
    }
  };

  const save = (payload: AdjustmentPayload) => {
    const target = dialog?.adjustment;
    void run(
      () => (target ? updateSalaryAdjustment(salary.id, target.id, payload) : addSalaryAdjustment(salary.id, payload)),
      '조정 항목을 저장했습니다.',
      '조정 항목을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
    );
  };

  return (
    <SectionCard
      title="조정"
      description={editable ? '인센티브, 차감, 보너스를 사유와 함께 넣어요. 재계산해도 남아요.' : '지급 완료된 급여는 조정할 수 없어요.'}
      className={`print-section ${adjustments.length === 0 ? 'no-print' : ''}`}
      bodyClassName="print-compact"
    >
      {editable ? (
        <div className="mb-1 grid grid-cols-2 gap-2 no-print sm:flex">
          <Button type="button" size="sm" onClick={() => setDialog({ mode: 'add', adjustment: null })}><Plus className="h-4 w-4" />조정 추가</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ mode: 'match', adjustment: null })}><Target className="h-4 w-4" />실수령액 맞추기</Button>
        </div>
      ) : null}
      {adjustments.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">조정 항목이 없어요.</p> : (
        <ul className="divide-y divide-border/60" data-testid="salary-adjustments">
          {adjustments.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold text-foreground">
                  {item.label}
                  {Number(item.taxable) ? null : <Badge variant="secondary">세금 제외</Badge>}
                </div>
                {item.memo ? <p className="mt-0.5 break-keep text-[13px] text-muted-foreground">{item.memo}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={`font-bold tabular-nums ${item.amount < 0 ? 'text-destructive' : 'text-success'}`}>{formatSignedWon(item.amount)}</span>
                {editable ? (
                  <span className="flex no-print">
                    <Button type="button" variant="ghost" size="icon" aria-label={`${item.label} 수정`} onClick={() => setDialog({ mode: 'edit', adjustment: item })}><Edit3 className="h-4 w-4" /></Button>
                    <Button
                      type="button" variant="ghost" size="icon" aria-label={`${item.label} 삭제`} disabled={busy}
                      onClick={() => void run(() => deleteSalaryAdjustment(salary.id, item.id), '조정 항목을 삭제했습니다.', '조정 항목을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog ? (
        <SalaryAdjustmentDialog
          mode={dialog.mode}
          adjustment={dialog.adjustment}
          netSalary={toNumber(salary.net_salary)}
          saving={busy}
          onClose={() => setDialog(null)}
          onSave={save}
        />
      ) : null}
    </SectionCard>
  );
}
