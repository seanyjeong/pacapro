'use client';

import { useBranchTree } from '@/hooks/use-branches';

interface SeasonBranchFieldProps {
  value: number | null | undefined;
  className: string; // 폼의 입력칸 모양
  onChange: (branchId: number | null) => void;
}

/** 시즌 지점: 전 지점 또는 지점 하나. 지점이 없는 학원에는 나오지 않는다. */
export function SeasonBranchField({ value, className, onChange }: SeasonBranchFieldProps) {
  const { branches } = useBranchTree();
  if (branches.length === 0) return null;

  return (
    <label className="grid gap-1.5 text-[13px] font-semibold text-secondary-foreground">
      지점
      <select
        aria-label="시즌 지점"
        className={className}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">전 지점</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>{branch.name}</option>
        ))}
      </select>
    </label>
  );
}
