import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Branch, StudentPlacement } from '@/lib/api/branches';
import { StudentPlacementSelect } from './student-placement-select';

interface StudentsBulkPlacementBarProps {
  branches: Branch[];
  count: number;
  moving: boolean;
  onMove: (placement: StudentPlacement) => void;
  onClear: () => void;
}

// 목록에서 고른 학생들을 한 번에 다른 지점·반으로 옮긴다.
export function StudentsBulkPlacementBar({ branches, count, moving, onMove, onClear }: StudentsBulkPlacementBarProps) {
  const [target, setTarget] = useState<StudentPlacement>({ branch_id: null, class_id: null });

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-primary-soft p-3 sm:flex-row sm:items-center" aria-label="선택한 학생 옮기기">
      <p className="shrink-0 text-sm font-bold text-primary">{count}명 선택</p>
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <StudentPlacementSelect branches={branches} value={target} onChange={setTarget} disabled={moving} placeholder="옮길 지점·반 선택" />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={moving || !target.branch_id} onClick={() => onMove(target)}>
          {moving ? '옮기는 중…' : '옮기기'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={moving} onClick={onClear}>
          선택 해제
        </Button>
      </div>
    </section>
  );
}
