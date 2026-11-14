'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useBranchTree } from '@/hooks/use-branches';
import type { StudentPlacement } from '@/lib/api/branches';
import { StudentPlacementSelect } from './student-placement-select';
import { useStudentMove } from './use-student-move';

interface StudentPlacementPanelProps {
  value: StudentPlacement;
  // studentId 가 있으면 고르는 즉시 저장하고, 없으면(신규 등록) 고른 값만 알려 준다.
  studentId?: number;
  onChange: (placement: StudentPlacement) => void;
}

// 지점을 쓰는 학원에서만 보이는 학생의 지점·반 선택.
export function StudentPlacementPanel({ value, studentId, onChange }: StudentPlacementPanelProps) {
  const { branches, enabled, reload } = useBranchTree();
  const [saving, setSaving] = useState(false);
  const studentMove = useStudentMove();
  if (!enabled) return null;

  const handleChange = async (placement: StudentPlacement) => {
    if (!studentId) return onChange(placement);
    setSaving(true);
    try {
      // 새 반 학원비가 지금과 다르면 묻고, 고른 경우에만 학원비도 바꾼다.
      const result = await studentMove.move([studentId], placement);
      if (!result.moved) return;
      toast.success(result.tuitionUpdated > 0 ? '지점·반과 학원비를 바꿨습니다.' : '지점·반을 바꿨습니다.');
      onChange(placement);
      void reload();
    } catch {
      toast.error('지점·반을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-card p-5">
      <label htmlFor="student-placement" className="shrink-0 text-[15px] font-bold text-foreground">지점·반</label>
      <div className="min-w-0">
        <StudentPlacementSelect id="student-placement" branches={branches} value={value} onChange={handleChange} disabled={saving} />
      </div>
      {studentMove.dialog}
    </section>
  );
}
