import type { Branch, StudentPlacement } from '@/lib/api/branches';

interface StudentPlacementSelectProps {
  branches: Branch[];
  value: StudentPlacement;
  onChange: (placement: StudentPlacement) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

const NONE = '';

// 한 번에 고르는 지점·반 선택. 반을 고르면 지점은 그 반의 지점이다.
export function StudentPlacementSelect({
  branches,
  value,
  onChange,
  disabled,
  placeholder = '배정 안 함',
  className = 'h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-300',
  id,
}: StudentPlacementSelectProps) {
  const selected = value.class_id ? `c:${value.class_id}` : value.branch_id ? `b:${value.branch_id}` : NONE;

  const handleChange = (next: string) => {
    if (next === NONE) return onChange({ branch_id: null, class_id: null });
    const [kind, rawId] = next.split(':');
    const targetId = Number(rawId);
    if (kind === 'b') return onChange({ branch_id: targetId, class_id: null });
    const branch = branches.find((item) => item.classes.some((cls) => cls.id === targetId));
    onChange({ branch_id: branch?.id ?? null, class_id: targetId });
  };

  return (
    <select id={id} value={selected} disabled={disabled} onChange={(event) => handleChange(event.target.value)} className={className}>
      <option value={NONE}>{placeholder}</option>
      {branches.map((branch) => (
        <optgroup key={branch.id} label={branch.name}>
          <option value={`b:${branch.id}`}>{branch.name} (반 없음)</option>
          {branch.classes.map((cls) => (
            <option key={cls.id} value={`c:${cls.id}`}>
              {branch.name} {cls.class_name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
