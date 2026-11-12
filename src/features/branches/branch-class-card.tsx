'use client';

import { useState } from 'react';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsSectionCard } from '@/features/settings/settings-section-card';
import { getSettingsSaveErrorMessage } from '@/features/settings/settings-error-message';
import { BRANCH_TREE_QUERY_KEY, useBranchTree } from '@/hooks/use-branches';
import { branchesAPI } from '@/lib/api/branches';

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
                <div key={cls.id} className="flex items-center gap-2">
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
