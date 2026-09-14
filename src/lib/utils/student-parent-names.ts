import type { StudentParentNames } from '../types/student-parent-names';

export function visibleParentName(value: string | null | undefined): string {
  if (typeof value !== 'string' || /^ENC:/i.test(value.trim())) return '';
  return value.trim();
}

export function matchesStudentIdentity(
  student: StudentParentNames & { student_name?: string; name?: string; student_number?: string },
  query: string,
): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase('ko');
  const keyword = normalize(query);
  if (!keyword) return true;
  return [student.student_name, student.name, student.student_number,
    visibleParentName(student.father_name), visibleParentName(student.mother_name)]
    .some((value) => typeof value === 'string' && !/^ENC:/i.test(value.trim()) && normalize(value).includes(keyword));
}
