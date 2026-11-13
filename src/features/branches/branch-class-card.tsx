'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
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
function NameInput({ label, name, disabled, onSave }: { label: string; name: string; disabled: boolean; onSave: (name: string) => void }) {
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
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      className="h-9"
    />
  );
}

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
                'h-8 w-8 rounded-md border text-xs font-medium transition-colors disabled:opacity-50',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
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
        className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
      >
        {TIME_SLOT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {instructors.length > 0 ? (
        <select
          aria-label={`${label} 담당 강사`}
          value={cls.instructor_id ?? ''}
          disabled={disabled}
          onChange={(event) => onSave({ instructor_id: event.target.value ? Number(event.target.value) : null })}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
        >
          <option value="">담당 강사 없음</option>
          {instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}
        </select>
      ) : null}
      {cls.class_days.length > 0 && cls.active_count > 0 ? (
        <Link href={`/students/class-days?class=${cls.id}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
          학생 {cls.active_count}명에게 적용
        </Link>
      ) : null}
    </div>
  );
}

function AddRow({ placeholder, buttonLabel, disabled, onAdd }: { placeholder: string; buttonLabel: string; disabled: boolean; onAdd: (name: string) => void }) {
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
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
        className="h-9"
      />
      <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" disabled={disabled || !draft.trim()} onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
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
      description="한 계정으로 여러 지점을 함께 관리할 때만 만드세요. 지점을 만들지 않으면 모든 화면이 지금 그대로입니다."
    >
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">지점·반을 불러오는 중입니다.</p>}

      <div className="space-y-4">
        {branches.map((branch) => (
          <section key={branch.id} className="rounded-md border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <NameInput
                  key={branch.name}
                  label={`${branch.name} 지점 이름`}
                  name={branch.name}
                  disabled={busy}
                  onSave={(name) => void act(() => branchesAPI.updateBranch(branch.id, { name }, quiet))}
                />
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">재원 {branch.active_count}명</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`${branch.name} 지점 삭제`}
                disabled={busy || branch.student_count > 0 || branch.classes.length > 0}
                title={branch.student_count > 0 || branch.classes.length > 0 ? '반이나 학생이 있으면 지울 수 없습니다' : undefined}
                onClick={() => void act(() => branchesAPI.deleteBranch(branch.id, quiet))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 space-y-2 border-l-2 border-border/70 pl-4">
              {branch.classes.map((cls) => (
                <div key={cls.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <NameInput
                        key={cls.class_name}
                        label={`${branch.name} ${cls.class_name} 반 이름`}
                        name={cls.class_name}
                        disabled={busy}
                        onSave={(name) => void act(() => branchesAPI.updateClass(cls.id, { class_name: name }, quiet))}
                      />
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">재원 {cls.active_count}명</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
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
