'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PayRuleFormFields } from './pay-rule-form-fields';
import type { PayRuleForm, PayRulePayload } from './pay-rule-types';
import { apiErrorCode, apiErrorMessage, payRuleFormError, toPayRulePayload } from './pay-rule-utils';

interface PayRuleDialogProps {
  title: string;
  initialForm: PayRuleForm;
  fixedOnly?: boolean;
  children?: ReactNode;
  onSave: (payload: PayRulePayload) => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}

export function PayRuleDialog({ title, initialForm, fixedOnly, children, onSave, onClose, onSaved }: PayRuleDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [askMismatch, setAskMismatch] = useState(false);

  const save = async (confirmMismatch: boolean) => {
    const error = payRuleFormError(form);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...toPayRulePayload(form), ...(confirmMismatch ? { confirm_mismatch: true } : {}) });
      toast.success('급여 규칙을 저장했습니다.');
      onSaved();
    } catch (err) {
      if (apiErrorCode(err) === 'INSTALLMENT_MISMATCH') setAskMismatch(true);
      else toast.error(apiErrorMessage(err, '급여 규칙을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setSaving(false);
    }
  };

  const change = (next: PayRuleForm) => {
    setAskMismatch(false);
    setForm(next);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 px-6 py-3">
          {children}
          <PayRuleFormFields form={form} fixedOnly={fixedOnly} onChange={change} />
          {askMismatch ? (
            <p className="break-keep rounded-xl bg-warning/10 px-4 py-3 text-sm text-foreground" role="alert">
              나눈 합계가 총액과 달라요. 이대로 저장하려면 한 번 더 누르세요.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>취소</Button>
          <Button type="button" disabled={saving} onClick={() => void save(askMismatch)}>{saving ? '저장 중' : askMismatch ? '그대로 저장' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
