import type { Branch } from '@/lib/api/branches';

interface ClassRosterSelectProps {
  branches: Branch[];
  classId: number | null;
  className?: string;
  onChange: (classId: number | null) => void;
}

/** 출석 화면의 반 고르기. 지점이 없는 학원에는 나오지 않는다. */
export function ClassRosterSelect({ branches, classId, className, onChange }: ClassRosterSelectProps) {
  if (branches.length === 0) return null;

  return (
    <select
      aria-label="반으로 보기"
      value={classId ?? ''}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className={className}
    >
      <option value="">전체 (반으로 안 나눔)</option>
      {branches.map((branch) => (
        <optgroup key={branch.id} label={branch.name}>
          {branch.classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {branch.name} {cls.class_name}{cls.instructor_name ? ` · ${cls.instructor_name}` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
