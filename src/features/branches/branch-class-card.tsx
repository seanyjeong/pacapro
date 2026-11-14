'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsSectionCard } from '@/features/settings/settings-section-card';
import { getSettingsSaveErrorMessage } from '@/features/settings/settings-error-message';
import { BRANCH_TREE_QUERY_KEY, useBranchTree } from '@/hooks/use-branches';
import { branchesAPI, type BranchClass, type BranchTimeSlot } from '@/lib/api/branches';
import { instructorsAPI } from '@/lib/api/instructors';
import { WEEKDAY_OPTIONS } from '@/lib/types/student';
import { cn } from '@/lib/utils';

const quiet = { suppressErrorToast: true };

// 이름을 바로 고치는 칸: 포커스를 떼거나 Enter 를 누르면 저장한다.
function NameInput({ label, name, disabled, className, onSave }: { label: string; name: string; disabled: boolean; className?: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const save = () => {
    const next = draft.trim();
    if (next && next !== name) onSave(next);
    else setDraft(name);
  };
  return (
    <Input
      aria-label={label}
      value={draft}
      maxLength={100}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      className={className}
    />
  );
}

// 반 줄 안의 작은 고르기 칸
const selectClass = 'h-9 rounded-lg border border-transparent bg-muted px-2.5 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-50';

const TIME_SLOT_OPTIONS: Array<{ value: BranchTimeSlot; label: string }> = [
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

// 반의 수업 요일·시간대. 누르면 바로 저장한다. 학생 수업일은 "학생에게 적용"을 눌러야 바뀐다.
function ClassDaysRow({ label, cls, instructors, disabled, onSave }: {
  label: string;
  cls: BranchClass;
  instructors: Array<{ id: number; name: string }>;
  disabled: boolean;
  onSave: (data: { class_days?: number[]; default_time_slot?: BranchTimeSlot; instructor_id?: number | null }) => void;
}) {
  const toggle = (day: number) => onSave({
    class_days: cls.class_days.includes(day) ? cls.class_days.filter((item) => item !== day) : [...cls.class_days, day],
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1" role="group" aria-label={`${label} 수업 요일`}>
        {WEEKDAY_OPTIONS.map((option) => {
          const active = cls.class_days.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-label={`${label} ${option.label}요일`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => toggle(option.value)}
              className={cn(
                'h-9 w-9 rounded-full text-sm font-semibold transition-colors disabled:opacity-50',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-primary-soft hover:text-primary'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <select
        aria-label={`${label} 수업 시간대`}
        value={cls.default_time_slot}
        disabled={disabled}
        onChange={(event) => onSave({ default_time_slot: event.target.value as BranchTimeSlot })}
        className={selectClass}
      >
        {TIME_SLOT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {instructors.length > 0 ? (
        <select
          aria-label={`${label} 담당 강사`}
          value={cls.instructor_id ?? ''}
          disabled={disabled}
          onChange={(event) => onSave({ instructor_id: event.target.value ? Number(event.target.value) : null })}
          className={selectClass}
        >
          <option value="">담당 강사 없음</option>
          {instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}
        </select>
      ) : null}
      {cls.class_days.length > 0 && cls.active_count > 0 ? (
        <Link href={`/students/class-days?class=${cls.id}`} className="inline-flex h-9 items-center rounded-lg bg-primary-soft px-3 text-[13px] font-semibold text-primary hover:bg-primary-soft/70">
          학생 {cls.active_count}명에게 적용
        </Link>
      ) : null}
    </div>
  );
}

function AddRow({ placeholder, buttonLabel, disabled, inputClassName, onAdd }: { placeholder: string; buttonLabel: string; disabled: boolean; inputClassName?: string; onAdd: (name: string) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft('');
  };
  return (
    <div className="flex gap-2">
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={draft}
        maxLength={100}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
        className={inputClassName}
      />
      <Button type="button" variant="secondary" className="shrink-0" disabled={disabled || !draft.trim()} onClick={add}>
        <Plus className="h-4 w-4" />
        {buttonLabel}
      </Button>
    </div>
  );
}

export function BranchClassCard() {
  const queryClient = useQueryClient();
  const { branches, loading } = useBranchTree();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 반 담당 강사 고르기에 쓰는 강사 목록. 못 읽으면 고르는 칸만 안 나온다.
  const [instructors, setInstructors] = useState<Array<{ id: number; name: string }>>([]);
  useEffect(() => {
    instructorsAPI.getInstructors({ status: 'active' }, quiet)
      .then((data) => setInstructors(data.instructors.map((instructor) => ({ id: instructor.id, name: instructor.name }))))
      .catch(() => setInstructors([]));
  }, []);

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (err) {
      setError(getSettingsSaveErrorMessage(err));
    } finally {
      // 지점·반 이름과 인원수를 쓰는 화면(학생 목록 등)이 같이 새로 읽는다.
      await queryClient.invalidateQueries({ queryKey: BRANCH_TREE_QUERY_KEY });
      setBusy(false);
    }
  }

  return (
    <SettingsSectionCard
      id="branches"
      title="지점·반"
      icon={Building2}
      description="한 계정으로 여러 지점을 함께 관리할 때만 만드세요. 지점을 만들지 않으면 모든 화면이 지금 그대로예요."
    >
      {error && <p role="alert" className="mb-4 rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">지점·반을 불러오는 중이에요.</p>}

      <div className="space-y-3">
        {branches.map((branch) => (
          <section key={branch.id} className="rounded-xl bg-muted p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <NameInput
                  key={branch.name}
                  label={`${branch.name} 지점 이름`}
                  name={branch.name}
                  disabled={busy}
                  className="bg-card text-base font-bold"
                  onSave={(name) => void act(() => branchesAPI.updateBranch(branch.id, { name }, quiet))}
                />
              </div>
              <Badge variant="secondary" className="shrink-0 bg-card tabular-nums">재원 {branch.active_count}명</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${branch.name} 지점 삭제`}
                disabled={busy || branch.student_count > 0 || branch.classes.length > 0}
                title={branch.student_count > 0 || branch.classes.length > 0 ? '반이나 학생이 있으면 지울 수 없습니다' : undefined}
                onClick={() => void act(() => branchesAPI.deleteBranch(branch.id, quiet))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {branch.classes.map((cls) => (
                <div key={cls.id} className="space-y-3 rounded-xl bg-card p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <NameInput
                        key={cls.class_name}
                        label={`${branch.name} ${cls.class_name} 반 이름`}
                        name={cls.class_name}
                        disabled={busy}
                        className="h-10 font-semibold"
                        onSave={(name) => void act(() => branchesAPI.updateClass(cls.id, { class_name: name }, quiet))}
                      />
                    </div>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">재원 {cls.active_count}명</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${branch.name} ${cls.class_name} 반 삭제`}
                      disabled={busy || cls.student_count > 0}
                      title={cls.student_count > 0 ? '학생이 있으면 지울 수 없습니다' : undefined}
                      onClick={() => void act(() => branchesAPI.deleteClass(cls.id, quiet))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <ClassDaysRow
                    label={`${branch.name} ${cls.class_name}`}
                    cls={cls}
                    instructors={instructors}
                    disabled={busy}
                    onSave={(data) => void act(() => branchesAPI.updateClass(cls.id, data, quiet))}
                  />
                </div>
              ))}
              <AddRow
                placeholder={`${branch.name}에 추가할 반 이름 (예: 정시반)`}
                buttonLabel="반 추가"
                disabled={busy}
                inputClassName="bg-card"
                onAdd={(name) => void act(() => branchesAPI.createClass(branch.id, name, quiet))}
              />
            </div>
          </section>
        ))}

        <AddRow
          placeholder="추가할 지점 이름 (예: 수성)"
          buttonLabel="지점 추가"
          disabled={busy}
          onAdd={(name) => void act(() => branchesAPI.createBranch(name, quiet))}
        />
      </div>
    </SettingsSectionCard>
  );
}
