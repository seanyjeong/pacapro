'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/page';
import { createPayRule, updatePayRule } from './pay-rule-api';
import { PayRuleDeleteDialog } from './pay-rule-delete-dialog';
import { PayRuleDialog } from './pay-rule-dialog';
import { PayRuleList } from './pay-rule-list';
import { emptyPayRuleForm, toPayRuleForm } from './pay-rule-utils';
import { usePayRules } from './use-pay-rules';

interface InstructorPayRulesSectionProps {
  instructorId: number;
  salaryType: string;
  onChanged: () => void;
}

export function InstructorPayRulesSection({ instructorId, salaryType, onChanged }: InstructorPayRulesSectionProps) {
  const state = usePayRules({ instructorId });
  // 월급 강사는 기본 월급을 그대로 두고 고정급만 더한다
  const fixedOnly = salaryType === 'monthly' && (!state.editing || state.editing.pay_type === 'fixed_total');
  const saved = () => {
    state.saved();
    onChanged();
  };

  return (
    <SectionCard
      title="급여 규칙"
      description="기간별 단가나 고정급, 나눠 주는 금액을 정해요."
      actions={<Button type="button" size="sm" onClick={() => state.setAdding(true)}><Plus className="h-4 w-4" />규칙 추가</Button>}
    >
      <div data-testid="instructor-pay-rules">
        {state.failed
          ? <p className="py-6 text-center text-sm text-muted-foreground">급여 규칙을 불러오지 못했습니다.</p>
          : <PayRuleList rules={state.rules} emptyText="급여 규칙이 없어요. 기본 급여대로 계산해요." onEdit={state.setEditing} onDelete={state.setDeleting} />}
      </div>
      {state.adding || state.editing ? (
        <PayRuleDialog
          title={state.editing ? '급여 규칙 수정' : '급여 규칙 추가'}
          initialForm={state.editing ? toPayRuleForm(state.editing) : emptyPayRuleForm()}
          fixedOnly={fixedOnly}
          onSave={(payload) => (state.editing ? updatePayRule(state.editing.id, payload) : createPayRule(instructorId, payload))}
          onClose={state.close}
          onSaved={saved}
        />
      ) : null}
      <PayRuleDeleteDialog open={state.deleting !== null} busy={state.busy} onCancel={() => state.setDeleting(null)} onConfirm={() => void state.confirmDelete().then(onChanged)} />
    </SectionCard>
  );
}
