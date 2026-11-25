'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionCard } from '@/components/ui/page';
import { instructorsAPI } from '@/lib/api/instructors';
import type { Instructor } from '@/lib/types/instructor';
import type { Season } from '@/lib/types/season';
import { createSeasonPayRules, syncSeasonPayRules, updatePayRule } from './pay-rule-api';
import { PayRuleDeleteDialog } from './pay-rule-delete-dialog';
import { PayRuleDialog } from './pay-rule-dialog';
import { PayRuleList } from './pay-rule-list';
import { apiErrorMessage, emptyPayRuleForm, toPayRuleForm } from './pay-rule-utils';
import { usePayRules } from './use-pay-rules';

export function SeasonPayRulesSection({ season }: { season: Season }) {
  const state = usePayRules({ seasonId: season.id });
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [syncing, setSyncing] = useState(false);
  const start = season.season_start_date.slice(0, 10);
  const end = season.season_end_date.slice(0, 10);
  const different = state.rules.filter((rule) => rule.start_date?.slice(0, 10) !== start || rule.end_date?.slice(0, 10) !== end);

  useEffect(() => {
    if (!state.adding) return;
    instructorsAPI.getInstructors({ status: 'active' }, { suppressErrorToast: true })
      .then((response) => setInstructors(response.instructors ?? []))
      .catch(() => toast.error('강사 목록을 불러오지 못했습니다.'));
  }, [state.adding]);

  const sync = async () => {
    setSyncing(true);
    try {
      await syncSeasonPayRules(season.id, different.map((rule) => rule.id));
      toast.success('급여 규칙 기간을 시즌에 맞췄습니다.');
      await state.reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, '급여 규칙 기간을 바꾸지 못했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setSyncing(false);
    }
  };

  const toggle = (id: number) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const save = async (payload: Parameters<typeof updatePayRule>[1]) => {
    if (state.editing) return updatePayRule(state.editing.id, payload);
    return createSeasonPayRules(season.id, selected, payload);
  };

  return (
    <SectionCard
      title="시즌 강사 급여"
      description="시즌 동안 고정급을 받는 강사와 나눠 줄 달을 정해요."
      actions={<Button type="button" size="sm" onClick={() => { setSelected([]); state.setAdding(true); }}><Plus className="h-4 w-4" />강사 추가</Button>}
    >
      <div data-testid="season-pay-rules">
        {different.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm">
            <span className="break-keep text-foreground">시즌 기간({start} ~ {end})과 다른 급여 규칙이 {different.length}개 있어요. 시즌 기간으로 바꿀까요?</span>
            <Button type="button" size="sm" variant="outline" disabled={syncing} onClick={() => void sync()}>{syncing ? '바꾸는 중' : '시즌 기간에 맞추기'}</Button>
          </div>
        ) : null}
        {state.failed
          ? <p className="py-6 text-center text-sm text-muted-foreground">시즌 강사 급여를 불러오지 못했습니다.</p>
          : <PayRuleList rules={state.rules} showInstructor emptyText="시즌 고정급을 받는 강사가 없어요." onEdit={state.setEditing} onDelete={state.setDeleting} />}
      </div>
      {state.adding || state.editing ? (
        <PayRuleDialog
          title={state.editing ? `${state.editing.instructor_name} 시즌 급여 수정` : '시즌 강사 추가'}
          initialForm={state.editing ? toPayRuleForm(state.editing) : emptyPayRuleForm({ start_date: start, end_date: end })}
          fixedOnly
          onSave={save}
          onClose={state.close}
          onSaved={state.saved}
        >
          {state.editing ? null : (
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-secondary-foreground">강사 ({selected.length}명) — 한 사람마다 아래 금액을 받아요</p>
              <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto">
                {instructors.map((instructor) => (
                  <label key={instructor.id} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold text-foreground" htmlFor={`season-instructor-${instructor.id}`}>
                    <Checkbox id={`season-instructor-${instructor.id}`} checked={selected.includes(instructor.id)} onCheckedChange={() => toggle(instructor.id)} />
                    <span className="truncate">{instructor.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </PayRuleDialog>
      ) : null}
      <PayRuleDeleteDialog open={state.deleting !== null} busy={state.busy} onCancel={() => state.setDeleting(null)} onConfirm={() => void state.confirmDelete()} />
    </SectionCard>
  );
}
