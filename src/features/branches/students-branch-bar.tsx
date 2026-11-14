import { cn } from '@/lib/utils/cn';
import type { Branch } from '@/lib/api/branches';
import type { StudentFilters } from '@/lib/types/student';

interface StudentsBranchBarProps {
  branches: Branch[];
  unassignedCount: number;
  branchId: StudentFilters['branch_id'];
  classId: StudentFilters['class_id'];
  onChange: (placement: Pick<StudentFilters, 'branch_id' | 'class_id'>) => void;
}

function Chip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
        active ? 'bg-foreground text-background' : 'bg-card text-secondary-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
      <span className={cn('text-xs tabular-nums', active ? 'text-background/80' : 'text-muted-foreground')}>{count}</span>
    </button>
  );
}

// 지점·반별 재원생 수를 보여 주고, 누르면 그 지점·반 학생만 목록에 남긴다.
export function StudentsBranchBar({ branches, unassignedCount, branchId, classId, onChange }: StudentsBranchBarProps) {
  const total = branches.reduce((sum, branch) => sum + branch.active_count, unassignedCount);
  const selectedBranch = branches.find((branch) => branch.id === branchId);

  return (
    <section className="space-y-2" aria-label="지점·반">
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        <Chip active={!branchId} label="전체 지점" count={total} onClick={() => onChange({ branch_id: undefined, class_id: undefined })} />
        {branches.map((branch) => (
          <Chip
            key={branch.id}
            active={branch.id === branchId}
            label={branch.name}
            count={branch.active_count}
            onClick={() => onChange({ branch_id: branch.id, class_id: undefined })}
          />
        ))}
        {unassignedCount > 0 && (
          <Chip
            active={branchId === 'none'}
            label="지점 없음"
            count={unassignedCount}
            onClick={() => onChange({ branch_id: 'none', class_id: undefined })}
          />
        )}
      </div>
      {selectedBranch && (
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          <Chip active={!classId} label={`${selectedBranch.name} 전체`} count={selectedBranch.active_count}
            onClick={() => onChange({ branch_id: selectedBranch.id, class_id: undefined })} />
          {selectedBranch.classes.map((cls) => (
            <Chip
              key={cls.id}
              active={cls.id === classId}
              label={cls.class_name}
              count={cls.active_count}
              onClick={() => onChange({ branch_id: selectedBranch.id, class_id: cls.id })}
            />
          ))}
          <Chip
            active={classId === 'none'}
            label="반 없음"
            count={selectedBranch.active_count - selectedBranch.classes.reduce((sum, cls) => sum + cls.active_count, 0)}
            onClick={() => onChange({ branch_id: selectedBranch.id, class_id: 'none' })}
          />
        </div>
      )}
    </section>
  );
}
