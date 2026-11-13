'use client';

import { useBranchTree } from '@/hooks/use-branches';

interface BranchSelectProps {
  value: number | null;
  onChange: (branchId: number | null) => void;
}

/** 지점 하나 고르기(상담 등록·수정). 지점이 없는 학원에는 나오지 않는다. */
export function BranchSelect({ value, onChange }: BranchSelectProps) {
  const { branches } = useBranchTree();
  if (branches.length === 0) return null;

  return (
    <div>
      <label className="text-sm font-medium text-foreground" htmlFor="consultation-branch">지점</label>
      <select
        id="consultation-branch"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
      >
        <option value="">지점 없음</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>{branch.name}</option>
        ))}
      </select>
    </div>
  );
}
