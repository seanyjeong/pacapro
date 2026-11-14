'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { Branch } from '@/lib/api/branches';
import { getCurrentUser } from '@/lib/utils/permissions';

/** 체크한 지점에 드는가. 아무것도 체크하지 않았으면 전체. 0 = 지점 없음. */
export function inBranches(branchId: number | null | undefined, selected: number[]): boolean {
  return selected.length === 0 || selected.includes(branchId ?? 0);
}

/**
 * 지점 체크 상태. 직원 계정에 담당 지점이 있으면 화면이 열릴 때 그 지점이 체크돼 있다.
 * 보는 범위를 막는 것이 아니라 처음 값일 뿐이다 — 체크를 풀면 다른 지점도 보인다.
 */
export function useBranchChecks(): [number[], (selected: number[]) => void] {
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => {
    const mine = getCurrentUser()?.branch_ids;
    if (mine?.length) setSelected(mine);
  }, []);
  return [selected, setSelected];
}

interface BranchChecksProps {
  branches: Branch[];
  selected: number[];
  className?: string;
  withoutNone?: boolean; // '지점 없음' 칸을 빼기(직원 담당 지점)
  onChange: (selected: number[]) => void;
}

/** 지점별로 보는 칩. 아무것도 고르지 않으면(전체) 모든 지점이다. 지점이 없는 학원에는 나오지 않는다. */
export function BranchChecks({ branches, selected, className, withoutNone, onChange }: BranchChecksProps) {
  if (branches.length === 0) return null;

  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const options = [...branches.map((branch) => ({ id: branch.id, label: branch.name })), ...(withoutNone ? [] : [{ id: 0, label: '지점 없음' }])];
  const chip = (active: boolean) => cn(
    'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition-colors',
    active ? 'bg-foreground text-background' : 'bg-card text-secondary-foreground hover:bg-muted hover:text-foreground'
  );

  return (
    <section className={cn('-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5', className)} aria-label="지점별 보기">
      <button type="button" aria-pressed={selected.length === 0} className={chip(selected.length === 0)} onClick={() => onChange([])}>
        전체 지점
      </button>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={selected.includes(option.id)}
          className={chip(selected.includes(option.id))}
          onClick={() => toggle(option.id)}
        >
          {option.label}
        </button>
      ))}
    </section>
  );
}
