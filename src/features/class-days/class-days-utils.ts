import type { ClassDaysStudent } from '@/lib/types/student';

export const GRADE_ORDER_MAP: Record<string, number> = {
  고1: 1,
  고2: 2,
  고3: 3,
  N수: 4,
};

export function getEffectiveMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [
    { value: 'immediate', label: '즉시 적용 (이번 달)' },
  ];

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    options.push({
      value: `${year}-${String(month).padStart(2, '0')}-01`,
      label: `${year}년 ${month}월부터`,
    });
  }

  return options;
}

export function filterAndSortClassDaysStudents(
  students: ClassDaysStudent[],
  filterGrade: string,
  filterWeekly: string,
  searchQuery: string,
  focusedStudentId: number | null = null
) {
  const q = searchQuery.trim().toLowerCase();

  return students
    .filter((student) => {
      if (focusedStudentId !== null && student.id !== focusedStudentId) return false;
      if (filterGrade !== 'all' && student.grade !== filterGrade) return false;
      if (filterWeekly !== 'all' && student.weekly_count !== Number(filterWeekly)) return false;
      if (q && !student.name.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const gradeA = GRADE_ORDER_MAP[a.grade || ''] ?? 99;
      const gradeB = GRADE_ORDER_MAP[b.grade || ''] ?? 99;
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.name.localeCompare(b.name, 'ko');
    });
}
