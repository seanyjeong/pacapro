'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import type { BranchClass } from '@/lib/api/branches';
import { cn } from '@/lib/utils';
import { WEEKLY_TUITION_KEYS, type WeeklyTuitionTable } from '@/lib/utils/tuition-table';
import { ClassTuitionApplyDialog } from './class-tuition-apply-dialog';

const emptyTable = (): WeeklyTuitionTable =>
  Object.fromEntries(WEEKLY_TUITION_KEYS.map((key) => [key, 0])) as WeeklyTuitionTable;
const sameTable = (a: WeeklyTuitionTable | null, b: WeeklyTuitionTable | null) =>
  WEEKLY_TUITION_KEYS.every((key) => (a?.[key] ?? 0) === (b?.[key] ?? 0));

interface ClassTuitionRowProps {
  label: string; // "수성 정시반"
  cls: BranchClass;
  disabled: boolean;
  onSave: (table: WeeklyTuitionTable | null) => void;
  onApplied: () => void;
}

/**
 * 반 학원비: "학원 기본표 그대로" / "이 반만 따로" + 주1~7회 금액.
 * 표를 바꿔도 학생 학원비는 그대로다 — "반 학원비 적용"에서 학생별 금액을 확인하고 바꾼다.
 */
export function ClassTuitionRow({ label, cls, disabled, onSave, onApplied }: ClassTuitionRowProps) {
  // 옛 응답(칸 없음)도 학원 기본표로 본다
  const saved = cls.tuition_by_weekly ?? null;
  const [own, setOwn] = useState(saved !== null);
  const [draft, setDraft] = useState<WeeklyTuitionTable>(saved ?? emptyTable());
  const [applyOpen, setApplyOpen] = useState(false);
  const hasAmount = WEEKLY_TUITION_KEYS.some((key) => draft[key] > 0);
  const dirty = !sameTable(draft, saved);

  const chooseDefault = () => {
    setOwn(false);
    setDraft(emptyTable());
    if (saved !== null) onSave(null);
  };

  const segment = (active: boolean) => cn(
    'h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:opacity-50',
    active ? 'bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-muted-foreground hover:text-foreground'
  );

  return (
    <div className="space-y-3 border-t border-border/60 pt-3" data-testid={`class-tuition-${cls.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-secondary-foreground">학원비</span>
        <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label={`${label} 학원비 기준`}>
          <button type="button" aria-pressed={!own} disabled={disabled} className={segment(!own)} onClick={chooseDefault}>
            학원 기본표 그대로
          </button>
          <button type="button" aria-pressed={own} disabled={disabled} className={segment(own)} onClick={() => setOwn(true)}>
            이 반만 따로
          </button>
        </div>
        {saved !== null && cls.student_count > 0 ? (
          <Button type="button" size="sm" variant="secondary" className="ml-auto" disabled={disabled || dirty} onClick={() => setApplyOpen(true)}>
            반 학원비 적용
          </Button>
        ) : null}
      </div>

      {own ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {WEEKLY_TUITION_KEYS.map((key, index) => (
              <label key={key} className="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                주 {index + 1}회
                <MoneyInput
                  aria-label={`${label} 주 ${index + 1}회 학원비`}
                  value={draft[key]}
                  disabled={disabled}
                  suffix=""
                  onChange={(amount) => setDraft((current) => ({ ...current, [key]: amount }))}
                  className="h-10 rounded-lg border-transparent bg-muted px-3 text-sm tabular-nums focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground">금액은 원 단위예요. 0원인 횟수는 수업일을 바꿔도 학원비를 자동으로 바꾸지 않아요.</p>
            <Button type="button" size="sm" disabled={disabled || !dirty || !hasAmount} onClick={() => onSave(draft)}>
              반 학원비 저장
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[12px] text-muted-foreground">설정의 입시반·성인반 학원비 표를 그대로 써요.</p>
      )}

      {applyOpen ? (
        <ClassTuitionApplyDialog
          classId={cls.id}
          label={label}
          onClose={() => setApplyOpen(false)}
          onApplied={() => { setApplyOpen(false); onApplied(); }}
        />
      ) : null}
    </div>
  );
}
