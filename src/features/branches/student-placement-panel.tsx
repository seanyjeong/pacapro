'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useBranchTree } from '@/hooks/use-branches';
import { branchesAPI, type StudentPlacement } from '@/lib/api/branches';
import { StudentPlacementSelect } from './student-placement-select';

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
  if (!enabled) return null;

  const handleChange = async (placement: StudentPlacement) => {
    if (!studentId) return onChange(placement);
    setSaving(true);
    try {
      await branchesAPI.assignStudents([studentId], placement, { suppressErrorToast: true });
      toast.success('지점·반을 바꿨습니다.');
      onChange(placement);
      void reload();
    } catch {
      toast.error('지점·반을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center">
      <label htmlFor="student-placement" className="shrink-0 text-sm font-medium text-foreground">지점·반</label>
      <div className="min-w-0 flex-1 sm:max-w-sm">
        <StudentPlacementSelect id="student-placement" branches={branches} value={value} onChange={handleChange} disabled={saving} />
      </div>
    </section>
  );
}
