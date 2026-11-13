import { cn } from '@/lib/utils/cn';
import type { Branch } from '@/lib/api/branches';

/** 체크한 지점에 드는가. 아무것도 체크하지 않았으면 전체. 0 = 지점 없음. */
export function inBranches(branchId: number | null | undefined, selected: number[]): boolean {
  return selected.length === 0 || selected.includes(branchId ?? 0);
}

interface BranchChecksProps {
  branches: Branch[];
  selected: number[];
  className?: string;
  onChange: (selected: number[]) => void;
}

/** 학원비 매출·미납을 지점별로 보는 체크 상자. 지점이 없는 학원에는 나오지 않는다. */
export function BranchChecks({ branches, selected, className, onChange }: BranchChecksProps) {
  if (branches.length === 0) return null;

  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const options = [...branches.map((branch) => ({ id: branch.id, label: branch.name })), { id: 0, label: '지점 없음' }];

  return (
    <section className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-3 text-sm', className)} aria-label="지점별 보기">
      <span className="font-medium">지점</span>
      {options.map((option) => (
        <label key={option.id} className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={selected.includes(option.id)}
            onChange={() => toggle(option.id)}
          />
          {option.label}
        </label>
      ))}
      <span className="text-muted-foreground">
        {selected.length === 0 ? '체크하지 않으면 전체 지점' : '체크한 지점만 합쳐서 봅니다'}
      </span>
    </section>
  );
}
